import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as workspaceService from "./workspace.service.js";
import { createWorkspaceSchema } from "./workspace.validation.js";

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

