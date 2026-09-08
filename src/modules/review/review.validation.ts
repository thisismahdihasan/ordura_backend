import { z } from "zod";

export const createReviewAnnotationParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
    reviewId: z.string().trim().min(1, "reviewId is required"),
  })
  .strict();

export type CreateReviewAnnotationParamsInput = z.infer<
  typeof createReviewAnnotationParamsSchema
>;

export const createReviewAnnotationBodySchema = z
  .object({
    x: z
      .number({
        message: "x must be a number",
      })
      .finite("x must be a finite number")
      .min(0, "x must be between 0 and 1")
      .max(1, "x must be between 0 and 1"),
    y: z
      .number({
        message: "y must be a number",
      })
      .finite("y must be a finite number")
      .min(0, "y must be between 0 and 1")
      .max(1, "y must be between 0 and 1"),
    comment: z
      .string({
        message: "comment must be a string",
      })
      .trim()
      .min(1, "comment cannot be empty")
      .max(2000, "comment cannot exceed 2000 characters"),
  })
  .strict();

export type CreateReviewAnnotationBodyInput = z.infer<
  typeof createReviewAnnotationBodySchema
>;
