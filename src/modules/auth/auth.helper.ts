import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { CookieOptions, JwtPayload } from "./auth.type.js";

import crypto from "node:crypto";

const BCRYPT_SALT_ROUNDS = 12;
const OTP_BCRYPT_SALT_ROUNDS = 10;
const DUMMY_OTP_HASH =
  "$2b$10$e7mKzZ47Z0qI9YQpQyqSZe5t64bQ3wLzO0iQk7H8x9j0k1l2m3n4o";

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateOtpCode = (): string => {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
};

export const hashOtpCode = async (otp: string): Promise<string> => {
  return bcrypt.hash(otp, OTP_BCRYPT_SALT_ROUNDS);
};

export const compareOtpCode = async (
  otp: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(otp, hash);
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

export const hashResetToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

export const simulateNonExistentHashDelay = async (): Promise<void> => {
  await bcrypt.hash("000000", OTP_BCRYPT_SALT_ROUNDS);
};

export const simulateNonExistentCompareDelay = async (
  code: string
): Promise<void> => {
  await bcrypt.compare(code, DUMMY_OTP_HASH);
};

export const signAuthToken = (payload: JwtPayload): string => {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign(
    { userId: payload.userId, tokenVersion: payload.tokenVersion },
    env.JWT_SECRET,
    options
  );
};

export const verifyAuthToken = (token: string): JwtPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof decoded === "object" &&
    decoded !== null &&
    "userId" in decoded &&
    "tokenVersion" in decoded
  ) {
    const { userId, tokenVersion } = decoded as {
      userId: unknown;
      tokenVersion: unknown;
    };
    if (
      typeof userId === "string" &&
      userId.trim().length > 0 &&
      typeof tokenVersion === "number" &&
      Number.isInteger(tokenVersion)
    ) {
      return { userId, tokenVersion };
    }
  }

  throw new Error("Invalid token payload");
};

export const getAuthCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

export const getLogoutCookieOptions = (): CookieOptions => {
  const isProduction = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  };
};
