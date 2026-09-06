import { Request, Response, NextFunction } from "express";
import { WorkspaceRole } from "@prisma/client";
import prisma from "../lib/prisma.js";
import { ApiError } from "../shared/ApiError.js";
import { catchAsync } from "../utils/catchAsync.js";
import { AuthenticatedRequest } from "./requireAuth.js";

export type WorkspaceMembershipContext = {
  id: string;
  workspaceId: string;
  roles: WorkspaceRole[];
};

export type WorkspaceAuthorizedRequest = AuthenticatedRequest & {
  workspaceMembership: WorkspaceMembershipContext;
};

export const requireWorkspaceRole = (
  ...allowedRoles: WorkspaceRole[]
) => {
  if (allowedRoles.length === 0) {
    throw new Error(
      "requireWorkspaceRole requires at least one allowed WorkspaceRole"
    );
  }

  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const authUser = (req as AuthenticatedRequest).user;
      if (!authUser?.id) {
        throw new ApiError(401, "Authentication required");
      }

      const workspaceId = req.params?.workspaceId;
      if (!workspaceId || typeof workspaceId !== "string" || workspaceId.trim() === "") {
        throw new ApiError(400, "Workspace ID is required");
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspaceId.trim(),
            userId: authUser.id,
          },
        },
        select: {
          id: true,
          workspaceId: true,
          roles: true,
        },
      });

      if (!membership) {
        throw new ApiError(403, "You do not have access to this workspace");
      }

      const hasAllowedRole = allowedRoles.some((role) =>
        membership.roles.includes(role)
      );

      if (!hasAllowedRole) {
        throw new ApiError(403, "Insufficient workspace permissions");
      }

      (req as WorkspaceAuthorizedRequest).workspaceMembership = membership;

      next();
    }
  );
};

export default requireWorkspaceRole;
