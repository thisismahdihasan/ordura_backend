import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { createWorkspaceInvite } from "./workspaceInvite.service.js";
import { createWorkspaceInviteSchema } from "./workspaceInvite.validation.js";

export const createInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const validatedInput = createWorkspaceInviteSchema.parse(req.body);

  const result = await createWorkspaceInvite(authReq.user.id, validatedInput);

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Workspace invite created successfully",
    data: result,
  });
};
