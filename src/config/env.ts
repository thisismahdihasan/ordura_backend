import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z
    .string()
    .regex(
      /^\d+[smhdwy]$/,
      "JWT_EXPIRES_IN must be a valid timespan (e.g. 7d, 24h, 3600s)"
    )
    .default("7d"),
  COOKIE_NAME: z.string().default("ordura_token"),
  SMTP_HOST: z.string().min(1, "SMTP_HOST is required"),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, "SMTP_USER is required"),
  SMTP_PASS: z.string().min(1, "SMTP_PASS is required"),
  SMTP_FROM: z.string().min(1, "SMTP_FROM is required"),
  FRONTEND_INVITE_URL: z.string().url("FRONTEND_INVITE_URL must be a valid URL"),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  GOOGLE_CLIENT_ID: z.string().trim().optional(),
  GOOGLE_CLIENT_SECRET: z.string().trim().optional(),
  GOOGLE_REDIRECT_URI: z.string().trim().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().trim().optional(),
  CRON_SECRET: z
    .string()
    .trim()
    .min(32, "CRON_SECRET must be at least 32 characters"),
})
.superRefine((data, ctx) => {
  const hasCloudName = Boolean(data.CLOUDINARY_CLOUD_NAME && data.CLOUDINARY_CLOUD_NAME.trim().length > 0);
  const hasApiKey = Boolean(data.CLOUDINARY_API_KEY && data.CLOUDINARY_API_KEY.trim().length > 0);
  const hasApiSecret = Boolean(data.CLOUDINARY_API_SECRET && data.CLOUDINARY_API_SECRET.trim().length > 0);

  const anyProvided = hasCloudName || hasApiKey || hasApiSecret;
  const allProvided = hasCloudName && hasApiKey && hasApiSecret;

  if (data.NODE_ENV === "production") {
    if (!hasCloudName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_CLOUD_NAME is required in production",
        path: ["CLOUDINARY_CLOUD_NAME"],
      });
    }
    if (!hasApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_API_KEY is required in production",
        path: ["CLOUDINARY_API_KEY"],
      });
    }
    if (!hasApiSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_API_SECRET is required in production",
        path: ["CLOUDINARY_API_SECRET"],
      });
    }
  } else if (anyProvided && !allProvided) {
    if (!hasCloudName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_CLOUD_NAME is required when Cloudinary configuration is provided",
        path: ["CLOUDINARY_CLOUD_NAME"],
      });
    }
    if (!hasApiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_API_KEY is required when Cloudinary configuration is provided",
        path: ["CLOUDINARY_API_KEY"],
      });
    }
    if (!hasApiSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "CLOUDINARY_API_SECRET is required when Cloudinary configuration is provided",
        path: ["CLOUDINARY_API_SECRET"],
      });
    }
  }

  // Google Drive configuration validation
  const hasGoogleClientId = Boolean(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_ID.trim().length > 0);
  const hasGoogleClientSecret = Boolean(data.GOOGLE_CLIENT_SECRET && data.GOOGLE_CLIENT_SECRET.trim().length > 0);
  const hasGoogleRedirectUri = Boolean(data.GOOGLE_REDIRECT_URI && data.GOOGLE_REDIRECT_URI.trim().length > 0);
  const hasGoogleEncryptionKey = Boolean(data.GOOGLE_TOKEN_ENCRYPTION_KEY && data.GOOGLE_TOKEN_ENCRYPTION_KEY.trim().length > 0);

  const anyGoogleProvided = hasGoogleClientId || hasGoogleClientSecret || hasGoogleRedirectUri || hasGoogleEncryptionKey;
  const allGoogleProvided = hasGoogleClientId && hasGoogleClientSecret && hasGoogleRedirectUri && hasGoogleEncryptionKey;

  if (data.NODE_ENV === "production") {
    if (!hasGoogleClientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_CLIENT_ID is required in production",
        path: ["GOOGLE_CLIENT_ID"],
      });
    }
    if (!hasGoogleClientSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_CLIENT_SECRET is required in production",
        path: ["GOOGLE_CLIENT_SECRET"],
      });
    }
    if (!hasGoogleRedirectUri) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_REDIRECT_URI is required in production",
        path: ["GOOGLE_REDIRECT_URI"],
      });
    }
    if (!hasGoogleEncryptionKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_TOKEN_ENCRYPTION_KEY is required in production",
        path: ["GOOGLE_TOKEN_ENCRYPTION_KEY"],
      });
    }
  } else if (anyGoogleProvided && !allGoogleProvided) {
    if (!hasGoogleClientId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_CLIENT_ID is required when Google Drive configuration is provided",
        path: ["GOOGLE_CLIENT_ID"],
      });
    }
    if (!hasGoogleClientSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_CLIENT_SECRET is required when Google Drive configuration is provided",
        path: ["GOOGLE_CLIENT_SECRET"],
      });
    }
    if (!hasGoogleRedirectUri) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_REDIRECT_URI is required when Google Drive configuration is provided",
        path: ["GOOGLE_REDIRECT_URI"],
      });
    }
    if (!hasGoogleEncryptionKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_TOKEN_ENCRYPTION_KEY is required when Google Drive configuration is provided",
        path: ["GOOGLE_TOKEN_ENCRYPTION_KEY"],
      });
    }
  }

  // If redirect URI is provided, validate URL format
  if (hasGoogleRedirectUri && data.GOOGLE_REDIRECT_URI) {
    try {
      new URL(data.GOOGLE_REDIRECT_URI);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_REDIRECT_URI must be a valid URL",
        path: ["GOOGLE_REDIRECT_URI"],
      });
    }
  }

  // If encryption key is provided, validate 64-character hexadecimal format (32 bytes for AES-256)
  if (hasGoogleEncryptionKey && data.GOOGLE_TOKEN_ENCRYPTION_KEY) {
    if (!/^[0-9a-fA-F]{64}$/.test(data.GOOGLE_TOKEN_ENCRYPTION_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GOOGLE_TOKEN_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)",
        path: ["GOOGLE_TOKEN_ENCRYPTION_KEY"],
      });
    }
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Invalid environment variables:", parsedEnv.error.format());
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
export default env;
