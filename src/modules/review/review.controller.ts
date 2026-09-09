import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as reviewService from "./review.service.js";
import {
  approveReviewBodySchema,
  approveReviewParamsSchema,
  createAnnotationReplyBodySchema,
  createAnnotationReplyParamsSchema,
  createReviewAnnotationBodySchema,
  createReviewAnnotationParamsSchema,
  requestCorrectionBodySchema,
  requestCorrectionParamsSchema,
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

// Handles HTTP request for creating a threaded reply on an existing review annotation.
export const createAnnotationReply = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, annotationId } =
    createAnnotationReplyParamsSchema.parse(req.params);
  const validatedBody = createAnnotationReplyBodySchema.parse(req.body);

  const result = await reviewService.createAnnotationReply(
    workspaceId,
    annotationId,
    authReq.user.id,
    validatedBody
  );

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Annotation reply created successfully",
    data: result,
  });
};

// Handles HTTP request for requesting design corrections on the current review round.
export const requestReviewCorrection = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId, reviewId } = requestCorrectionParamsSchema.parse(
    req.params
  );
  requestCorrectionBodySchema.parse(req.body);

  const result = await reviewService.requestReviewCorrection(
    workspaceId,
    reviewId
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Correction requested successfully",
    data: result,
  });
};

// Handles HTTP request for approving the current review round.
export const approveReviewSubmission = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, reviewId } = approveReviewParamsSchema.parse(
    req.params
  );
  approveReviewBodySchema.parse(req.body);

  const result = await reviewService.approveReviewSubmission(
    workspaceId,
    reviewId,
    authReq.user.id
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Design approved successfully",
    data: result,
  });
};

