import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../shared/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { verifyAuthToken } from "../modules/auth/auth.helper.js";
import { getUserById } from "../modules/auth/auth.service.js";
import { SafeUser } from "../modules/auth/auth.type.js";

export type AuthenticatedRequest = Request & {
  user: SafeUser;
};

// Enforces authentication cookie presence, validates JWT integrity, and attaches user profile to request.
export const requireAuth = catchAsync(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[env.COOKIE_NAME];

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    let userId: string;
    try {
      const payload = verifyAuthToken(token);
      userId = payload.userId;
    } catch {
      throw new ApiError(401, "Invalid or expired authentication token");
    }

    const user = await getUserById(userId);

    if (!user) {
      throw new ApiError(401, "User account no longer exists");
    }

    (req as AuthenticatedRequest).user = user;

    next();
  }
);

export default requireAuth;
