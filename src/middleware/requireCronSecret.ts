import { timingSafeEqual } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../shared/ApiError.js";

// Restricts system maintenance endpoints to callers holding the configured cron secret.
export const requireCronSecret = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const providedSecret = req.get("x-cron-secret");
  const expectedSecret = env.CRON_SECRET;

  if (!providedSecret) {
    throw new ApiError(401, "Unauthorized system request");
  }

  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Unauthorized system request");
  }

  next();
};

export default requireCronSecret;
