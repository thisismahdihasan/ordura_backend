import { Request, Response } from "express";
import { env } from "../../config/env.js";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { getAuthCookieOptions, getLogoutCookieOptions } from "./auth.helper.js";
import { loginUser, registerUser } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  const validatedInput = registerSchema.parse(req.body);

  const result = await registerUser(validatedInput);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  ApiResponse.success(res, {
    statusCode: 201,
    message: "User registered successfully",
    data: {
      user: result.user,
    },
  });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const validatedInput = loginSchema.parse(req.body);

  const result = await loginUser(validatedInput);

  res.cookie(env.COOKIE_NAME, result.token, getAuthCookieOptions());

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Logged in successfully",
    data: {
      user: result.user,
    },
  });
};

export const logout = async (_req: Request, res: Response): Promise<void> => {
  res.clearCookie(env.COOKIE_NAME, getLogoutCookieOptions());

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Logged out successfully",
  });
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
  const authReq = req as AuthenticatedRequest;

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Current user profile retrieved successfully",
    data: {
      user: authReq.user,
    },
  });
};
