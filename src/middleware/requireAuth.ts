import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../shared/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { verifyAuthToken } from "../modules/auth/auth.helper.js";
import { getUserAuthSession } from "../modules/auth/auth.service.js";
import { JwtPayload, SafeUser } from "../modules/auth/auth.type.js";

export type AuthenticatedRequest = Request & {
  user: SafeUser;
};

// Enforces authentication cookie presence, validates JWT integrity and tokenVersion, and attaches user profile.
export const requireAuth = catchAsync(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = req.cookies?.[env.COOKIE_NAME];

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    let payload: JwtPayload;
    try {
      payload = verifyAuthToken(token);
    } catch {
      throw new ApiError(401, "Invalid or expired authentication token");
    }

    const authSession = await getUserAuthSession(payload.userId);

    if (!authSession) {
      throw new ApiError(401, "User account no longer exists");
    }

    if (authSession.tokenVersion !== payload.tokenVersion) {
      throw new ApiError(401, "Invalid or expired authentication token");
    }

    (req as AuthenticatedRequest).user = authSession.user;

    next();
  }
);

export default requireAuth;
