import { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

const rateLimitMessage = "Too many requests. Please try again later.";

const sendRateLimitResponse = (_req: Request, res: Response): void => {
  res.status(429).json({
    success: false,
    message: rateLimitMessage,
  });
};

// Limits repeated login attempts per process and client IP for the MVP deployment.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitResponse,
});

// Limits account creation abuse per process and client IP for the MVP deployment.
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimitResponse,
});
