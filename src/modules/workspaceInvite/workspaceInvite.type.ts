import { WorkspaceRole } from "@prisma/client";

export type SafeWorkspaceInvite = {
  id: string;
  workspaceId: string;
  email: string;
  roles: WorkspaceRole[];
  expiresAt: Date;
  createdAt: Date;
};

export type CreateWorkspaceInviteResult = {
  invite: SafeWorkspaceInvite;
};
