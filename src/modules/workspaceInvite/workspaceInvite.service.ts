import { WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { generateInviteToken, hashInviteToken } from "./workspaceInvite.helper.js";
import { CreateWorkspaceInviteInput } from "./workspaceInvite.validation.js";
import { CreateWorkspaceInviteResult } from "./workspaceInvite.type.js";

const INVITE_EXPIRY_HOURS = 24;

const safeWorkspaceInviteSelect = {
  id: true,
  workspaceId: true,
  email: true,
  roles: true,
  expiresAt: true,
  createdAt: true,
} as const;

export const createWorkspaceInvite = async (
  callerUserId: string,
  input: CreateWorkspaceInviteInput
): Promise<CreateWorkspaceInviteResult> => {
  const adminMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId: callerUserId,
      roles: { has: WorkspaceRole.ADMIN },
    },
    select: {
      workspaceId: true,
    },
  });

  if (!adminMembership) {
    throw new ApiError(403, "Only workspace admins can create invites");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: adminMembership.workspaceId,
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
      workspaceId: adminMembership.workspaceId,
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
      workspaceId: adminMembership.workspaceId,
      email: input.email,
      roles: input.roles,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      invitedById: callerUserId,
    },
    select: safeWorkspaceInviteSelect,
  });

  // NOTE: Returning raw inviteToken is temporary for Phase 2C.1 testing until email sending is implemented in Phase 2C.2
  return {
    invite,
    inviteToken: rawToken,
  };
};
