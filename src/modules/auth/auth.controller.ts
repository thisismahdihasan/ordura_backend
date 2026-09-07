import { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { getAuthCookieOptions, getLogoutCookieOptions } from "./auth.helper.js";
import * as authService from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

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
