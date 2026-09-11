import { WorkspaceRole } from "@prisma/client";

export type SafeWorkspaceInvite = {
  id: string;
  workspaceId: string;
  email: string;
  roles: WorkspaceRole[];
  expiresAt: Date;
  createdAt: Date;
  lastSentAt: Date | null;
};

export type CreateWorkspaceInviteResult = {
  invite: SafeWorkspaceInvite;
};

export type WorkspaceInviteStatus = "EXPIRED" | "PENDING";

export type SafePendingWorkspaceInvite = {
  acceptedAt: Date | null;
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  lastSentAt: Date | null;
  roles: WorkspaceRole[];
  status: WorkspaceInviteStatus;
};

export type ListPendingWorkspaceInvitesResult = {
  invites: SafePendingWorkspaceInvite[];
};

export type ResendWorkspaceInviteResult = {
  invite: SafeWorkspaceInvite;
};

export type RevokeWorkspaceInviteResult = {
  inviteId: string;
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
