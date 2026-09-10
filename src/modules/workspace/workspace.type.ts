import { WorkspaceRole } from "@prisma/client";

export type SafeWorkspace = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SafeWorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  roles: WorkspaceRole[];
  createdAt: Date;
};

export type CreateWorkspaceResult = {
  workspace: SafeWorkspace;
  membership: SafeWorkspaceMember;
};

export type UserWorkspaceMembership = {
  id: string;
  roles: WorkspaceRole[];
  createdAt: Date;
};

export type UserWorkspace = SafeWorkspace & {
  membership: UserWorkspaceMembership;
};

export type GetUserWorkspacesResult = {
  workspaces: UserWorkspace[];
};

export type WorkspaceMemberListItem = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  roles: WorkspaceRole[];
  joinedAt: Date;
};

export type GetWorkspaceMembersResult = {
  members: WorkspaceMemberListItem[];
};
