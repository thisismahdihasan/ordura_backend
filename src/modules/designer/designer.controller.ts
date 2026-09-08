import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiError } from "../../shared/ApiError.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as designerService from "./designer.service.js";
import {
  ReviewImageDestroyer,
  ReviewImageUploader,
} from "./designer.review-storage.js";
import {
  getDesignerWorkQueueQuerySchema,
  reportDesignIssueBodySchema,
  reportDesignIssueParamsSchema,
  startCorrectionBodySchema,
  startCorrectionParamsSchema,
  startDesignWorkParamsSchema,
  submitDesignReviewBodySchema,
  submitDesignReviewParamsSchema,
} from "./designer.validation.js";

// Handles HTTP request for fetching the authenticated designer's active work queue.
export const getDesignerWorkQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedQuery = getDesignerWorkQueueQuerySchema.parse(req.query);

  const result = await designerService.getDesignerWorkQueue(
    workspaceId,
    authReq.user.id,
    validatedQuery
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Designer work queue retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for starting research/design work on an assigned item.
export const startDesignWork = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = startDesignWorkParamsSchema.parse(
    req.params
  );

  const result = await designerService.startDesignWork(
    workspaceId,
    researchItemId,
    authReq.user.id
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Design work started successfully",
    data: result,
  });
};

// Handles HTTP request for reporting an issue on an assigned research item.
export const reportDesignIssue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = reportDesignIssueParamsSchema.parse(
    req.params
  );
  const validatedBody = reportDesignIssueBodySchema.parse(req.body);

  const result = await designerService.reportAssignedDesignIssue(
    workspaceId,
    researchItemId,
    authReq.user.id,
    validatedBody
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Design issue reported successfully",
    data: result,
  });
};

// Handles HTTP request for submitting an assigned design for review.
export const submitDesignReview = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = submitDesignReviewParamsSchema.parse(
    req.params
  );
  const validatedBody = submitDesignReviewBodySchema.parse(req.body);

  if (!req.file || !req.file.buffer) {
    throw new ApiError(400, "Image file is required");
  }

  const uploader = req.app?.get("reviewImageUploader") as
    | ReviewImageUploader
    | undefined;
  const destroyer = req.app?.get("reviewImageDestroyer") as
    | ReviewImageDestroyer
    | undefined;

  const result = await designerService.submitAssignedDesignReview(
    workspaceId,
    researchItemId,
    authReq.user.id,
    {
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
    },
    validatedBody.note,
    uploader,
    destroyer
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Design submitted for review successfully",
    data: result,
  });
};

// Handles HTTP request for starting correction work on an assigned research item.
export const startCorrection = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = startCorrectionParamsSchema.parse(
    req.params
  );
  startCorrectionBodySchema.parse(req.body);

  const result = await designerService.startCorrection(
    workspaceId,
    researchItemId,
    authReq.user.id
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Design correction started successfully",
    data: result,
  });
};



