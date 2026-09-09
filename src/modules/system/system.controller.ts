import { Request, Response } from "express";
import { cleanupOldReviewImages } from "../review/reviewCleanup.service.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { cleanupReviewsBodySchema } from "./system.validation.js";

// Runs the established review-image cleanup process with its production defaults.
export const cleanupReviewImages = async (
  req: Request,
  res: Response
): Promise<void> => {
  cleanupReviewsBodySchema.parse(req.body);

  const result = await cleanupOldReviewImages();

  ApiResponse.success(res, {
    message: "Review image cleanup completed successfully",
    data: result,
  });
};
