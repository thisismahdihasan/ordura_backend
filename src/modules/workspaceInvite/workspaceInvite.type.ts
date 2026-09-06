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

export type SafeWorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  roles: WorkspaceRole[];
  createdAt: Date;
};

export type SafeAcceptedInvite = {
  id: string;
  acceptedAt: Date | null;
};

export type SafeWorkspaceSummary = {
  id: string;
  name: string;
};

export type AcceptWorkspaceInviteResult = {
  membership: SafeWorkspaceMember;
  workspace: SafeWorkspaceSummary;
  invite: SafeAcceptedInvite;
};
