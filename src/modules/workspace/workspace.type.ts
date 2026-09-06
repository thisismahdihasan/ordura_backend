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
