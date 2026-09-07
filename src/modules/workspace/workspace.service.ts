import { Prisma, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { CreateWorkspaceInput } from "./workspace.validation.js";
import { CreateWorkspaceResult } from "./workspace.type.js";

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
