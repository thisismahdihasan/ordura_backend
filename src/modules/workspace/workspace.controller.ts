import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as workspaceService from "./workspace.service.js";
import {
  createWorkspaceSchema,
  workspaceIdParamsSchema,
} from "./workspace.validation.js";

// Creates a new workspace and automatically assigns the creator as an ADMIN member.
export const createWorkspace = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const validatedInput = createWorkspaceSchema.parse(req.body);

  const result = await workspaceService.createWorkspace(
    authReq.user.id,
    validatedInput
  );

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Workspace created successfully",
    data: result,
  });
};

// Returns workspaces available to the authenticated user.
export const getUserWorkspaces = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const result = await workspaceService.getUserWorkspaces(authReq.user.id);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Workspaces retrieved successfully",
    data: result,
  });
};

// Returns a safe, ordered team directory for workspace administrators.
export const getWorkspaceMembers = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = workspaceIdParamsSchema.parse(req.params);
  const result = await workspaceService.getWorkspaceMembers(workspaceId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Workspace members retrieved successfully",
    data: result,
  });
};

