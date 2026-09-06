import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  acceptWorkspaceInvite,
  createWorkspaceInvite,
} from "./workspaceInvite.service.js";
import {
  acceptWorkspaceInviteParamsSchema,
  createWorkspaceInviteSchema,
} from "./workspaceInvite.validation.js";

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

export const acceptInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { token } = acceptWorkspaceInviteParamsSchema.parse(req.params);

  const result = await acceptWorkspaceInvite(
    authReq.user.id,
    authReq.user.email,
    token
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Workspace invitation accepted successfully",
    data: result,
  });
};
