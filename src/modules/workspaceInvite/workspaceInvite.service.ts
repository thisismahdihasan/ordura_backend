import { Prisma, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  getMailTransportErrorDetails,
  MailSendEvidence,
  sendMail,
} from "../../services/mail.service.js";
import { buildInviteEmail } from "./workspaceInvite.email.js";
import { generateInviteToken, hashInviteToken } from "./workspaceInvite.helper.js";
import { CreateWorkspaceInviteInput } from "./workspaceInvite.validation.js";
import {
  AcceptWorkspaceInviteResult,
  CreateWorkspaceInviteResult,
  ListPendingWorkspaceInvitesResult,
  ResendWorkspaceInviteResult,
  RevokeWorkspaceInviteResult,
} from "./workspaceInvite.type.js";

const INVITE_EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

const safeWorkspaceInviteSelect = {
  id: true,
  workspaceId: true,
  email: true,
  roles: true,
  expiresAt: true,
  createdAt: true,
  lastSentAt: true,
} as const;

const safeWorkspaceMemberSelect = {
  id: true,
  workspaceId: true,
  userId: true,
  roles: true,
  createdAt: true,
} as const;

const recoveryInviteSelect = {
  id: true,
  workspaceId: true,
  email: true,
  roles: true,
  tokenHash: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  lastSentAt: true,
  workspace: {
    select: {
      name: true,
    },
  },
} as const;

const pendingInviteSelect = {
  id: true,
  email: true,
  roles: true,
  createdAt: true,
  expiresAt: true,
  acceptedAt: true,
  lastSentAt: true,
} as const;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const maskRecipient = (email: string): string => {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf("@");

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) {
    return "[invalid-recipient]";
  }

  return `${normalizedEmail.slice(0, 1)}***@${normalizedEmail.slice(atIndex + 1)}`;
};

const recipientDomain = (email: string): string | null => {
  const normalizedEmail = normalizeEmail(email);
  const atIndex = normalizedEmail.lastIndexOf("@");

  return atIndex > 0 && atIndex < normalizedEmail.length - 1
    ? normalizedEmail.slice(atIndex + 1)
    : null;
};

const logInviteMailFailure = ({
  action,
  email,
  error,
  inviteId,
  workspaceId,
}: {
  action: "initial" | "resend";
  email: string;
  error: unknown;
  inviteId: string;
  workspaceId: string;
}): void => {
  const details = getMailTransportErrorDetails(error);

  console.warn("Workspace invitation mail submission failed", {
    action,
    inviteId,
    workspaceId,
    recipient: maskRecipient(email),
    recipientDomain: recipientDomain(email),
    smtpErrorCode: details.code,
    smtpCommand: details.command,
    smtpMessage: details.message,
    smtpResponse: details.response,
    smtpResponseCode: details.responseCode,
  });
};

const recipientWasAccepted = (
  evidence: MailSendEvidence,
  recipient: string
): boolean =>
  evidence.accepted.some(
    (acceptedRecipient) =>
      normalizeEmail(acceptedRecipient) === normalizeEmail(recipient)
  );

const sendWorkspaceInvitationEmail = async ({
  email,
  rawToken,
  roles,
  workspaceName,
}: {
  email: string;
  rawToken: string;
  roles: WorkspaceRole[];
  workspaceName: string;
}): Promise<MailSendEvidence> => {
  const emailContent = buildInviteEmail({
    workspaceName,
    roles,
    rawToken,
  });
  const evidence = await sendMail({
    to: email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  if (!recipientWasAccepted(evidence, email)) {
    throw new ApiError(502, "Mail server did not accept the invitation recipient");
  }

  return evidence;
};

const sendEvidenceData = (evidence: MailSendEvidence, sentAt: Date) => ({
  lastAccepted: evidence.accepted,
  lastMessageId: evidence.messageId,
  lastRejected: evidence.rejected,
  lastSentAt: sentAt,
  lastSmtpResponse: evidence.response,
});

const cleanupInviteAfterInitialSendFailure = async (inviteId: string) => {
  try {
    await prisma.workspaceInvite.delete({
      where: { id: inviteId },
    });
  } catch (cleanupError) {
    console.error(
      "CRITICAL: Failed to clean up orphan workspace invite after email delivery failure:",
      cleanupError
    );
  }
};

const getAdminWorkspace = async (callerUserId: string, workspaceId: string) => {
  const trimmedWorkspaceId = workspaceId.trim();

  if (!trimmedWorkspaceId) {
    throw new ApiError(400, "Workspace ID is required");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: trimmedWorkspaceId,
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
    throw new ApiError(403, "Only workspace admins can manage invites");
  }

  return {
    id: trimmedWorkspaceId,
    name: membership.workspace.name,
  };
};

// Generates a cryptographically secure workspace invitation and dispatches the invite email.
export const createWorkspaceInvite = async (
  callerUserId: string,
  input: CreateWorkspaceInviteInput,
  targetWorkspaceId?: string
): Promise<CreateWorkspaceInviteResult> => {
  let workspaceId: string;
  let workspaceName: string;

  if (targetWorkspaceId && targetWorkspaceId.trim().length > 0) {
    const workspace = await getAdminWorkspace(callerUserId, targetWorkspaceId);
    workspaceId = workspace.id;
    workspaceName = workspace.name;
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

  let evidence: MailSendEvidence;
  try {
    evidence = await sendWorkspaceInvitationEmail({
      email: input.email,
      rawToken,
      roles: input.roles,
      workspaceName,
    });
  } catch (error) {
    logInviteMailFailure({
      action: "initial",
      email: input.email,
      error,
      inviteId: invite.id,
      workspaceId,
    });
    await cleanupInviteAfterInitialSendFailure(invite.id);
    throw new ApiError(502, "Failed to send invitation email");
  }

  const sentAt = new Date();
  let sentInvite: typeof invite;

  try {
    sentInvite = await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: sendEvidenceData(evidence, sentAt),
      select: safeWorkspaceInviteSelect,
    });
  } catch (error) {
    console.error("Invite email was submitted but send evidence could not be persisted", {
      inviteId: invite.id,
      workspaceId,
    });
    throw new ApiError(502, "Invitation email submission could not be finalized");
  }

  return {
    invite: sentInvite,
  };
};

export const getPendingWorkspaceInvites = async (
  callerUserId: string,
  workspaceId: string,
  _status?: "pending"
): Promise<ListPendingWorkspaceInvitesResult> => {
  const workspace = await getAdminWorkspace(callerUserId, workspaceId);
  const now = new Date();
  const invites = await prisma.workspaceInvite.findMany({
    where: {
      workspaceId: workspace.id,
      acceptedAt: null,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    select: pendingInviteSelect,
  });

  return {
    invites: invites.map((invite) => ({
      ...invite,
      status: invite.expiresAt.getTime() <= now.getTime() ? "EXPIRED" : "PENDING",
    })),
  };
};

export const resendWorkspaceInvite = async (
  callerUserId: string,
  workspaceId: string,
  inviteId: string
): Promise<ResendWorkspaceInviteResult> => {
  const workspace = await getAdminWorkspace(callerUserId, workspaceId);
  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      id: inviteId,
      workspaceId: workspace.id,
    },
    select: recoveryInviteSelect,
  });

  if (!invite) {
    throw new ApiError(404, "Workspace invitation was not found");
  }

  if (invite.acceptedAt !== null) {
    throw new ApiError(409, "Accepted workspace invitations cannot be resent");
  }

  const now = new Date();
  const cooldownEndsAt = invite.lastSentAt
    ? invite.lastSentAt.getTime() + RESEND_COOLDOWN_MS
    : 0;

  if (cooldownEndsAt > now.getTime()) {
    const retryAfterSeconds = Math.ceil((cooldownEndsAt - now.getTime()) / 1000);
    throw new ApiError(
      429,
      "Workspace invitation resend is cooling down",
      true,
      "",
      { retryAfterSeconds }
    );
  }

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);
  let evidence: MailSendEvidence;

  try {
    evidence = await sendWorkspaceInvitationEmail({
      email: invite.email,
      rawToken,
      roles: invite.roles,
      workspaceName: invite.workspace.name,
    });
  } catch (error) {
    logInviteMailFailure({
      action: "resend",
      email: invite.email,
      error,
      inviteId: invite.id,
      workspaceId: workspace.id,
    });
    throw new ApiError(502, "Failed to resend workspace invitation email");
  }

  try {
    const updateResult = await prisma.workspaceInvite.updateMany({
      where: {
        id: invite.id,
        workspaceId: workspace.id,
        tokenHash: invite.tokenHash,
        acceptedAt: null,
      },
      data: {
        tokenHash,
        expiresAt,
        ...sendEvidenceData(evidence, now),
      },
    });

    if (updateResult.count === 0) {
      console.error("Invite email was submitted but resend finalization lost the invite state", {
        inviteId: invite.id,
        workspaceId: workspace.id,
      });
      throw new ApiError(409, "Workspace invitation state changed while resending");
    }

    const resentInvite = await prisma.workspaceInvite.findUniqueOrThrow({
      where: { id: invite.id },
      select: safeWorkspaceInviteSelect,
    });

    return { invite: resentInvite };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    console.error("Invite email was submitted but resend evidence could not be persisted", {
      inviteId: invite.id,
      workspaceId: workspace.id,
    });
    throw new ApiError(502, "Workspace invitation resend could not be finalized");
  }
};

export const revokeWorkspaceInvite = async (
  callerUserId: string,
  workspaceId: string,
  inviteId: string
): Promise<RevokeWorkspaceInviteResult> => {
  const workspace = await getAdminWorkspace(callerUserId, workspaceId);
  const invite = await prisma.workspaceInvite.findFirst({
    where: {
      id: inviteId,
      workspaceId: workspace.id,
    },
    select: {
      acceptedAt: true,
    },
  });

  if (!invite) {
    throw new ApiError(404, "Workspace invitation was not found");
  }

  if (invite.acceptedAt !== null) {
    throw new ApiError(409, "Accepted workspace invitations cannot be revoked");
  }

  const deletion = await prisma.workspaceInvite.deleteMany({
    where: {
      id: inviteId,
      workspaceId: workspace.id,
      acceptedAt: null,
    },
  });

  if (deletion.count === 0) {
    throw new ApiError(409, "Workspace invitation state changed while revoking");
  }

  return { inviteId };
};

// Validates the invitation token, verifies recipient email match, and grants workspace membership.
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

