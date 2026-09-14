import { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { getAuthCookieOptions, getLogoutCookieOptions } from "./auth.helper.js";
import * as authService from "./auth.service.js";
import {
  forgotPasswordResetSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.validation.js";

// Registers a new user account and sets the authentication session cookie.
export const registerUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedInput = registerSchema.parse(req.body);

  const result = await authService.registerUser(validatedInput);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  ApiResponse.success(res, {
    statusCode: 201,
    message: "User registered successfully",
    data: {
      user: result.user,
    },
  });
};

// Authenticates user credentials and issues a session cookie upon success.
export const loginUser = async (req: Request, res: Response): Promise<void> => {
  const validatedInput = loginSchema.parse(req.body);

  const result = await authService.loginUser(validatedInput);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Logged in successfully",
    data: {
      user: result.user,
    },
  });
};

// Clears the active authentication session cookie to log the user out.
export const logoutUser = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie(env.COOKIE_NAME, getLogoutCookieOptions());

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Logged out successfully",
  });
};

// Returns the profile of the currently authenticated user from request context.
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Current user profile retrieved successfully",
    data: {
      user: authReq.user,
    },
  });
};

// Updates the authenticated user's profile information (name and/or profile photo).
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const validatedInput = updateProfileSchema.parse(req.body);

  const file = req.file
    ? { buffer: req.file.buffer, mimetype: req.file.mimetype }
    : undefined;

  const user = await authService.updateUserProfile(
    authReq.user.id,
    validatedInput,
    file
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Profile updated successfully",
    data: {
      user,
    },
  });
};

// Initiates the forgot password flow by requesting an email OTP.
export const requestPasswordReset = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedInput = forgotPasswordRequestSchema.parse(req.body);
  const result = await authService.requestPasswordReset(validatedInput);

  ApiResponse.success(res, {
    statusCode: 200,
    message: result.message,
  });
};

// Verifies the 6-digit email OTP and produces a short-lived opaque reset token.
export const verifyPasswordResetOtp = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedInput = forgotPasswordVerifySchema.parse(req.body);
  const result = await authService.verifyPasswordResetOtp(validatedInput);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Verification successful.",
    data: {
      resetToken: result.resetToken,
    },
  });
};

// Resets the user password using a verified reset token and clears current browser cookie.
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedInput = forgotPasswordResetSchema.parse(req.body);
  const result = await authService.resetPasswordWithToken(validatedInput);

  res.clearCookie(env.COOKIE_NAME, getLogoutCookieOptions());

  ApiResponse.success(res, {
    statusCode: 200,
    message: result.message,
  });
};
