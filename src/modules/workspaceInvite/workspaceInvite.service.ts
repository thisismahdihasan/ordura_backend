import { Prisma, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { sendMail } from "../../services/mail.service.js";
import { buildInviteEmail } from "./workspaceInvite.email.js";
import { generateInviteToken, hashInviteToken } from "./workspaceInvite.helper.js";
import { CreateWorkspaceInviteInput } from "./workspaceInvite.validation.js";
import {
  AcceptWorkspaceInviteResult,
  CreateWorkspaceInviteResult,
} from "./workspaceInvite.type.js";

const INVITE_EXPIRY_HOURS = 24;

const safeWorkspaceInviteSelect = {
  id: true,
  workspaceId: true,
  email: true,
  roles: true,
  expiresAt: true,
  createdAt: true,
} as const;

const safeWorkspaceMemberSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  roles: true,
  createdAt: true,
} as const;

export const createWorkspaceInvite = async (
  callerUserId: string,
  input: CreateWorkspaceInviteInput,
  targetWorkspaceId?: string
): Promise<CreateWorkspaceInviteResult> => {
  let workspaceId: string;
  let workspaceName: string;

  if (targetWorkspaceId && targetWorkspaceId.trim().length > 0) {
    const trimmedId = targetWorkspaceId.trim();
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: trimmedId,
          userId: callerUserId,
        },
      },
      select: {
        roles: true,
        workspace: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!membership || !membership.roles.includes(WorkspaceRole.ADMIN)) {
      throw new ApiError(403, "Only workspace admins can create invites");
    }

    workspaceId = trimmedId;
    workspaceName = membership.workspace.name;
  } else {
    // If no target workspace specified, first check if caller owns a workspace
    const ownedWorkspace = await prisma.workspace.findUnique({
      where: { ownerId: callerUserId },
      select: {
        id: true,
        name: true,
      },
    });

    if (ownedWorkspace) {
      workspaceId = ownedWorkspace.id;
      workspaceName = ownedWorkspace.name;
    } else {
      // If caller does not own a workspace, check their admin memberships
      const adminMemberships = await prisma.workspaceMember.findMany({
        where: {
          userId: callerUserId,
          roles: { has: WorkspaceRole.ADMIN },
        },
        select: {
          workspaceId: true,
          workspace: {
            select: {
              name: true,
            },
          },
        },
      });

      if (adminMemberships.length === 0) {
        throw new ApiError(403, "Only workspace admins can create invites");
      }

      if (adminMemberships.length > 1) {
        throw new ApiError(
          400,
          "You are an admin in multiple workspaces. Please specify the target workspace ID in the request route."
        );
      }

      workspaceId = adminMemberships[0].workspaceId;
      workspaceName = adminMemberships[0].workspace.name;
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: existingUser.id,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      throw new ApiError(409, "User is already a member of this workspace");
    }
  }

  const activeInvite = await prisma.workspaceInvite.findFirst({
    where: {
      workspaceId,
      email: input.email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (activeInvite) {
    throw new ApiError(409, "An active invitation already exists for this email");
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  const invite = await prisma.workspaceInvite.create({
    data: {
      workspaceId,
      email: input.email,
      roles: input.roles,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      invitedById: callerUserId,
    },
    select: safeWorkspaceInviteSelect,
  });

  const emailContent = buildInviteEmail({
    workspaceName,
    roles: input.roles,
    rawToken,
  });

  try {
    await sendMail({
      to: input.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch (error) {
    try {
      await prisma.workspaceInvite.delete({
        where: { id: invite.id },
      });
    } catch (cleanupError) {
      console.error(
        "CRITICAL: Failed to clean up orphan workspace invite after email delivery failure:",
        cleanupError
      );
    }

    throw new ApiError(500, "Failed to send invitation email");
  }

  return {
    invite,
  };
};

export const acceptWorkspaceInvite = async (
  userId: string,
  userEmail: string,
  rawToken: string
): Promise<AcceptWorkspaceInviteResult> => {
  const tokenHash = hashInviteToken(rawToken);

  try {
    return await prisma.$transaction(async (tx) => {
      const invite = await tx.workspaceInvite.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          workspaceId: true,
          email: true,
          roles: true,
          expiresAt: true,
          acceptedAt: true,
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!invite) {
        throw new ApiError(400, "Invalid invitation");
      }

      if (invite.acceptedAt !== null) {
        throw new ApiError(409, "Invitation has already been accepted");
      }

      if (invite.expiresAt.getTime() <= Date.now()) {
        throw new ApiError(410, "Invitation has expired");
      }

      if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
        throw new ApiError(
          403,
          "This invitation was sent to a different email address"
        );
      }

      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId,
          },
        },
        select: { id: true },
      });

      if (existingMember) {
        throw new ApiError(409, "User is already a member of this workspace");
      }

      const updatedCount = await tx.workspaceInvite.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
        },
        data: {
          acceptedAt: new Date(),
        },
      });

      if (updatedCount.count === 0) {
        throw new ApiError(409, "Invitation has already been accepted");
      }

      const membership = await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          roles: invite.roles,
        },
        select: safeWorkspaceMemberSelect,
      });

      const acceptedInvite = await tx.workspaceInvite.findUniqueOrThrow({
        where: { id: invite.id },
        select: {
          id: true,
          acceptedAt: true,
        },
      });

      return {
        membership,
        workspace: invite.workspace,
        invite: acceptedInvite,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "User is already a member of this workspace");
    }
    throw error;
  }
};

