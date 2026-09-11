import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as workspaceInviteService from "./workspaceInvite.service.js";
import {
  acceptWorkspaceInviteParamsSchema,
  createWorkspaceInviteSchema,
  listWorkspaceInvitesQuerySchema,
  workspaceIdParamsSchema,
  workspaceInviteIdParamsSchema,
} from "./workspaceInvite.validation.js";

// Issues an email invitation with designated workspace roles to a prospective member.
export const createWorkspaceInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const validatedInput = createWorkspaceInviteSchema.parse(req.body);
  const rawWorkspaceId = req.params?.workspaceId;
  const targetWorkspaceId =
    typeof rawWorkspaceId === "string" ? rawWorkspaceId : undefined;

  const result = await workspaceInviteService.createWorkspaceInvite(
    authReq.user.id,
    validatedInput,
    targetWorkspaceId
  );

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Workspace invite created successfully",
    data: result,
  });
};

// Validates the invite token and adds the accepting user as a workspace member with the invited roles.
export const acceptWorkspaceInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { token } = acceptWorkspaceInviteParamsSchema.parse(req.params);

  const result = await workspaceInviteService.acceptWorkspaceInvite(
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

export const getPendingWorkspaceInvites = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { status } = listWorkspaceInvitesQuerySchema.parse(req.query);
  const { workspaceId } = workspaceIdParamsSchema.parse(req.params);

  const result = await workspaceInviteService.getPendingWorkspaceInvites(
    authReq.user.id,
    workspaceId,
    status
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Pending workspace invitations retrieved successfully",
    data: result,
  });
};

export const resendWorkspaceInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { inviteId, workspaceId } = workspaceInviteIdParamsSchema.parse(req.params);

  const result = await workspaceInviteService.resendWorkspaceInvite(
    authReq.user.id,
    workspaceId,
    inviteId
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Workspace invitation resent successfully",
    data: result,
  });
};

export const revokeWorkspaceInvite = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const { inviteId, workspaceId } = workspaceInviteIdParamsSchema.parse(req.params);

  const result = await workspaceInviteService.revokeWorkspaceInvite(
    authReq.user.id,
    workspaceId,
    inviteId
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Workspace invitation revoked successfully",
    data: result,
  });
};

