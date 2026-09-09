import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as listingService from "./listing.service.js";
import {
  backfillListingAssignmentsParamsSchema,
  getListerWorkQueueQuerySchema,
} from "./listing.validation.js";

// Handles HTTP request for fetching the authenticated lister's active work queue.
export const getListerWorkQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedQuery = getListerWorkQueueQuerySchema.parse(req.query);

  const result = await listingService.getListerWorkQueue(
    workspaceId,
    authReq.user.id,
    validatedQuery
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Lister work queue retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for manually backfilling unassigned READY_FOR_LISTING items.
export const backfillListingAssignments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = backfillListingAssignmentsParamsSchema.parse(
    req.params
  );

  const result = await listingService.backfillUnassignedListings(workspaceId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Unassigned listings backfilled successfully",
    data: result,
  });
};
