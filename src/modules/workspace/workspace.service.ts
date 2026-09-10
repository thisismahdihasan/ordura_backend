import { Prisma, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { CreateWorkspaceInput } from "./workspace.validation.js";
import {
  CreateWorkspaceResult,
  GetWorkspaceMembersResult,
  GetUserWorkspacesResult,
} from "./workspace.type.js";

const safeWorkspaceSelect = {
  id: true,
  name: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

const safeWorkspaceMemberSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  roles: true,
  createdAt: true,
} as const;

// Creates a new workspace and sets up the owner as an initial ADMIN member within a transaction.
export const createWorkspace = async (
  userId: string,
  input: CreateWorkspaceInput
): Promise<CreateWorkspaceResult> => {
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });

  if (existingWorkspace) {
    throw new ApiError(409, "User already owns a workspace");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: input.name,
          ownerId: userId,
        },
        select: safeWorkspaceSelect,
      });

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          roles: [WorkspaceRole.ADMIN],
        },
        select: safeWorkspaceMemberSelect,
      });

      return {
        workspace,
        membership,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "User already owns a workspace");
    }
    throw error;
  }
};

// Returns the authenticated user's workspace memberships for session restoration and workspace selection.
export const getUserWorkspaces = async (
  userId: string
): Promise<GetUserWorkspacesResult> => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId },
    select: {
      id: true,
      roles: true,
      createdAt: true,
      workspace: {
        select: safeWorkspaceSelect,
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return {
    workspaces: memberships.map((membership) => ({
      ...membership.workspace,
      membership: {
        id: membership.id,
        roles: membership.roles,
        createdAt: membership.createdAt,
      },
    })),
  };
};

// Returns safe workspace membership data for the admin team directory.
export const getWorkspaceMembers = async (
  workspaceId: string
): Promise<GetWorkspaceMembersResult> => {
  const memberships = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: {
      id: true,
      userId: true,
      roles: true,
      createdAt: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return {
    members: memberships.map((membership) => ({
      membershipId: membership.id,
      userId: membership.userId,
      name: membership.user.name,
      email: membership.user.email,
      roles: membership.roles,
      joinedAt: membership.createdAt,
    })),
  };
};
