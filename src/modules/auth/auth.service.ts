import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { comparePassword, hashPassword, signAuthToken } from "./auth.helper.js";
import { AuthResult, SafeUser } from "./auth.type.js";
import { LoginInput, RegisterInput } from "./auth.validation.js";

const safeUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
} as const;

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

    const token = signAuthToken({ userId: user.id });

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
      passwordHash: true,
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

  const token = signAuthToken({ userId: user.id });

  const safeUser: SafeUser = {
    id: user.id,
    email: user.email,
    name: user.name,
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

