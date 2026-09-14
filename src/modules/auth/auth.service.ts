import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { sendMail } from "../../services/mail.service.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  compareOtpCode,
  comparePassword,
  generateOtpCode,
  generateResetToken,
  hashOtpCode,
  hashPassword,
  hashResetToken,
  signAuthToken,
  simulateNonExistentCompareDelay,
  simulateNonExistentHashDelay,
} from "./auth.helper.js";
import { buildPasswordResetEmail } from "./passwordReset.email.js";
import {
  AuthResult,
  ForgotPasswordVerifyResult,
  SafeUser,
} from "./auth.type.js";
import {
  ForgotPasswordResetInput,
  ForgotPasswordRequestInput,
  ForgotPasswordVerifyInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from "./auth.validation.js";
import {
  AvatarDestroyer,
  AvatarUploader,
  AvatarUploadResult,
  destroyAvatarFromCloudinary,
  uploadAvatarToCloudinary,
} from "./auth.storage.js";

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  profileImageUrl: true,
  createdAt: true,
} as const;

export type UserAuthSession = {
  user: SafeUser;
  tokenVersion: number;
};

// Validates email uniqueness, securely hashes the password, and creates a new user record.
export const registerUser = async (
  input: RegisterInput
): Promise<AuthResult> => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
      },
      select: safeUserSelect,
    });

    const token = signAuthToken({ userId: user.id, tokenVersion: 0 });

    return {
      user,
      token,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "User with this email already exists");
    }
    throw error;
  }
};

// Verifies user credentials against the stored password hash and produces an authentication token.
export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      profileImageUrl: true,
      passwordHash: true,
      tokenVersion: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isPasswordValid = await comparePassword(
    input.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signAuthToken({
    userId: user.id,
    tokenVersion: user.tokenVersion,
  });

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    createdAt: user.createdAt,
  };

  return {
    user: safeUser,
    token,
  };
};

// Retrieves a user record by ID, omitting sensitive credentials like passwordHash.
export const getUserById = async (userId: string): Promise<SafeUser | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });
};

// Retrieves a user record and active tokenVersion for authentication verification.
export const getUserAuthSession = async (
  userId: string
): Promise<UserAuthSession | null> => {
  const record = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...safeUserSelect,
      tokenVersion: true,
    },
  });

  if (!record) {
    return null;
  }

  return {
    user: {
      id: record.id,
      email: record.email,
      name: record.name,
      profileImageUrl: record.profileImageUrl,
      createdAt: record.createdAt,
    },
    tokenVersion: record.tokenVersion,
  };
};

const GENERIC_REQUEST_RESPONSE = {
  message:
    "If an account exists for this email, we have sent a verification code.",
};

// Initiates a secure password reset flow with OTP generation and account enumeration protection.
export const requestPasswordReset = async (
  input: ForgotPasswordRequestInput
): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true },
  });

  if (!user) {
    await simulateNonExistentHashDelay();
    return GENERIC_REQUEST_RESPONSE;
  }

  const latestOtp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { lastSentAt: true },
  });

  const now = new Date();

  // Enforce 60-second cooldown per account
  if (latestOtp && now.getTime() - latestOtp.lastSentAt.getTime() < 60_000) {
    return GENERIC_REQUEST_RESPONSE;
  }

  // Enforce hourly cap: maximum 5 OTP sends per account in 1 hour
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const recentOtpCount = await prisma.passwordResetOtp.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentOtpCount >= 5) {
    return GENERIC_REQUEST_RESPONSE;
  }

  // Invalidate previous active reset records for this user
  await prisma.passwordResetOtp.updateMany({
    where: {
      userId: user.id,
      usedAt: null,
    },
    data: {
      usedAt: now,
    },
  });

  const rawOtp = generateOtpCode();
  const codeHash = await hashOtpCode(rawOtp);
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  const createdOtp = await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      codeHash,
      expiresAt,
      lastSentAt: now,
    },
    select: { id: true },
  });

  const emailContent = buildPasswordResetEmail({ rawOtp });

  try {
    await sendMail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch {
    await prisma.passwordResetOtp
      .delete({
        where: { id: createdOtp.id },
      })
      .catch(() => {});

    return GENERIC_REQUEST_RESPONSE;
  }

  return GENERIC_REQUEST_RESPONSE;
};

// Validates the 6-digit OTP and produces a single-use opaque reset token.
export const verifyPasswordResetOtp = async (
  input: ForgotPasswordVerifyInput
): Promise<ForgotPasswordVerifyResult> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (!user) {
    await simulateNonExistentCompareDelay(input.code);
    throw new ApiError(400, "Invalid or expired verification code.");
  }

  const now = new Date();
  const resetRecord = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: now },
      resetTokenHash: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!resetRecord) {
    throw new ApiError(400, "Invalid or expired verification code.");
  }

  if (resetRecord.attempts >= 5) {
    throw new ApiError(
      400,
      "Verification code is no longer valid. Request a new code."
    );
  }

  const isMatch = await compareOtpCode(input.code, resetRecord.codeHash);

  if (!isMatch) {
    const nextAttempts = resetRecord.attempts + 1;
    const isBurned = nextAttempts >= 5;

    await prisma.passwordResetOtp.update({
      where: { id: resetRecord.id },
      data: {
        attempts: { increment: 1 },
        ...(isBurned ? { usedAt: now } : {}),
      },
    });

    if (isBurned) {
      throw new ApiError(
        400,
        "Verification code is no longer valid. Request a new code."
      );
    }

    throw new ApiError(400, "Invalid or expired verification code.");
  }

  const rawResetToken = generateResetToken();
  const resetTokenHash = hashResetToken(rawResetToken);
  const resetExpiresAt = new Date(now.getTime() + 10 * 60 * 1000);

  await prisma.passwordResetOtp.update({
    where: { id: resetRecord.id },
    data: {
      resetTokenHash,
      resetExpiresAt,
      expiresAt: now,
    },
  });

  return {
    resetToken: rawResetToken,
  };
};

// Resets user password securely, updates tokenVersion, and invalidates active reset tokens.
export const resetPasswordWithToken = async (
  input: ForgotPasswordResetInput
): Promise<{ message: string }> => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (!user) {
    throw new ApiError(400, "Reset session is invalid or expired.");
  }

  const resetTokenHash = hashResetToken(input.resetToken);
  const now = new Date();

  const resetRecord = await prisma.passwordResetOtp.findFirst({
    where: {
      userId: user.id,
      resetTokenHash,
      usedAt: null,
      resetExpiresAt: { gt: now },
    },
  });

  if (!resetRecord) {
    throw new ApiError(400, "Reset session is invalid or expired.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.passwordResetOtp.update({
      where: { id: resetRecord.id },
      data: {
        usedAt: now,
      },
    }),
    prisma.passwordResetOtp.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    }),
  ]);

  return {
    message:
      "Password reset successfully. Please sign in with your new password.",
  };
};

export type UpdateUserProfileOptions = {
  uploader?: AvatarUploader;
  destroyer?: AvatarDestroyer;
};

const safelyDestroyAvatar = async (
  publicId: string,
  destroyer: AvatarDestroyer
): Promise<void> => {
  try {
    await destroyer(publicId);
  } catch {
    // The database update is already durable; cleanup can be retried operationally.
    console.warn("Avatar cleanup failed after profile update");
  }
};

// Updates authenticated user's profile (name and/or avatar) with safe replacement and rollback on error.
export const updateUserProfile = async (
  userId: string,
  input: UpdateProfileInput,
  file?: { buffer: Buffer; mimetype: string },
  options?: UpdateUserProfileOptions
): Promise<SafeUser> => {
  // 1. Conflict validation: cannot both provide a new avatar and request removal
  if (file && input.removeAvatar) {
    throw new ApiError(
      400,
      "Cannot upload a new avatar and remove avatar in the same request"
    );
  }

  // 2. Completeness validation: at least one editable field must be provided
  const hasName = input.name !== undefined;
  const hasAvatar = file !== undefined;
  const hasRemoveAvatar = input.removeAvatar === true;

  if (!hasName && !hasAvatar && !hasRemoveAvatar) {
    throw new ApiError(
      400,
      "At least one editable field (name, avatar, or removeAvatar) must be provided"
    );
  }

  // 3. Ensure target user exists and retrieve current avatar metadata
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      profileImagePublicId: true,
    },
  });

  if (!existingUser) {
    throw new ApiError(404, "User account not found");
  }

  const uploader = options?.uploader ?? uploadAvatarToCloudinary;
  const destroyer = options?.destroyer ?? destroyAvatarFromCloudinary;

  let newUploadResult: AvatarUploadResult | null = null;

  // 4. Upload new avatar to Cloudinary if provided
  if (file) {
    newUploadResult = await uploader({
      buffer: file.buffer,
      mimetype: file.mimetype,
    });
  }

  // 5. Construct database update payload restricted strictly to name and profile image
  const dataToUpdate: Prisma.UserUpdateInput = {};

  if (hasName && input.name !== undefined) {
    dataToUpdate.name = input.name;
  }

  if (newUploadResult) {
    dataToUpdate.profileImageUrl = newUploadResult.secureUrl;
    dataToUpdate.profileImagePublicId = newUploadResult.publicId;
  } else if (hasRemoveAvatar) {
    dataToUpdate.profileImageUrl = null;
    dataToUpdate.profileImagePublicId = null;
  }

  // 6. Persist changes to database with rollback of newly uploaded asset on failure
  let updatedUser: SafeUser;
  try {
    updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: safeUserSelect,
    });
  } catch (dbError) {
    if (newUploadResult) {
      await safelyDestroyAvatar(newUploadResult.publicId, destroyer);
    }
    throw dbError;
  }

  // 7. On database update success, clean up previously stored Cloudinary asset if replaced or removed
  if (
    existingUser.profileImagePublicId &&
    (newUploadResult || hasRemoveAvatar)
  ) {
    if (existingUser.profileImagePublicId !== newUploadResult?.publicId) {
      await safelyDestroyAvatar(existingUser.profileImagePublicId, destroyer);
    }
  }

  return updatedUser;
};
