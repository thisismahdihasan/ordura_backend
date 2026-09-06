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
  inviteToken: string; // Temporary for Phase 2C.1 until email service is implemented in Phase 2C.2
};
