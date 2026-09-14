import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z
    .string({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters long"),
  name: z
    .string()
    .trim()
    .min(1, "Name cannot be empty")
    .optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z
    .string({ message: "Password is required" })
    .min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
});

export const forgotPasswordVerifySchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  code: z
    .string({ message: "Verification code is required" })
    .trim()
    .regex(/^\d{6}$/, "Verification code must be exactly 6 digits"),
});

export const forgotPasswordResetSchema = z
  .object({
    email: z
      .string({ message: "Email is required" })
      .trim()
      .toLowerCase()
      .email("Invalid email address"),
    resetToken: z
      .string({ message: "Reset token is required" })
      .trim()
      .min(1, "Reset token is required"),
    password: z
      .string({ message: "Password is required" })
      .min(8, "Password must be at least 8 characters long"),
    confirmPassword: z
      .string({ message: "Confirm password is required" })
      .min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ForgotPasswordRequestInput = z.infer<
  typeof forgotPasswordRequestSchema
>;
export type ForgotPasswordVerifyInput = z.infer<
  typeof forgotPasswordVerifySchema
>;
export type ForgotPasswordResetInput = z.infer<
  typeof forgotPasswordResetSchema
>;

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name cannot be empty")
      .max(100, "Name must not exceed 100 characters")
      .optional(),
    removeAvatar: z
      .preprocess((val) => {
        if (val === "true" || val === true || val === "1") return true;
        if (val === "false" || val === false || val === "0") return false;
        return val;
      }, z.boolean().optional())
      .optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
