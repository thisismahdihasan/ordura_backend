import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { createWorkspace } from "./workspace.service.js";
import { createWorkspaceSchema } from "./workspace.validation.js";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const validatedInput = createWorkspaceSchema.parse(req.body);

  const result = await createWorkspace(authReq.user.id, validatedInput);

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Workspace created successfully",
    data: result,
  });
};
