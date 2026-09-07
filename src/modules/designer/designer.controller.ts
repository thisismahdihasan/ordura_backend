import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as designerService from "./designer.service.js";
import { getDesignerWorkQueueQuerySchema } from "./designer.validation.js";

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
