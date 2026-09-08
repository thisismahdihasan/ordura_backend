import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as reviewService from "./review.service.js";
import {
  createReviewAnnotationBodySchema,
  createReviewAnnotationParamsSchema,
} from "./review.validation.js";

// Handles HTTP request for creating an annotation on the current review screenshot.
export const createReviewAnnotation = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, reviewId } = createReviewAnnotationParamsSchema.parse(
    req.params
  );
  const validatedBody = createReviewAnnotationBodySchema.parse(req.body);

  const result = await reviewService.createReviewAnnotation(
    workspaceId,
    reviewId,
    authReq.user.id,
    validatedBody
  );

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Review annotation created successfully",
    data: result,
  });
};
