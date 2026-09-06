import { WorkspaceRole } from "@prisma/client";
import { env } from "../../config/env.js";

export type BuildInviteEmailOptions = {
  workspaceName: string;
  roles: WorkspaceRole[];
  rawToken: string;
};

export type BuiltInviteEmail = {
  subject: string;
  text: string;
  html: string;
};

export const buildInviteUrl = (rawToken: string): string => {
  const baseUrl = env.FRONTEND_INVITE_URL.replace(/\/$/, "");
  return `${baseUrl}/${rawToken}`;
};

export const buildInviteEmail = ({
  workspaceName,
  roles,
  rawToken,
}: BuildInviteEmailOptions): BuiltInviteEmail => {
  const inviteUrl = buildInviteUrl(rawToken);
  const formattedRoles = roles.join(", ");
  const subject = `Invitation to join ${workspaceName} on Ordura`;

  const text = `You have been invited to join ${workspaceName} on Ordura with the role(s): ${formattedRoles}.

This invitation is valid for 24 hours.

To accept this invitation, please visit the link below:
${inviteUrl}

If you were not expecting this invitation, you can safely ignore this email.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">You're invited to join ${workspaceName}</h2>
  <p>You have been invited to join <strong>${workspaceName}</strong> on Ordura with the following role(s):</p>
  <p style="background: #f4f4f5; padding: 10px 14px; border-radius: 6px; font-weight: bold; display: inline-block;">
    ${formattedRoles}
  </p>
  <p>This invitation will expire in <strong>24 hours</strong>.</p>
  <p style="margin: 28px 0;">
    <a href="${inviteUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
      Accept Invitation
    </a>
  </p>
  <p style="color: #666; font-size: 13px;">Or copy and paste this URL into your browser:</p>
  <p style="color: #666; font-size: 13px; word-break: break-all;">${inviteUrl}</p>
  <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">If you were not expecting this invitation, you can safely ignore this email.</p>
</body>
</html>`;

  return {
    subject,
    text,
    html,
  };
};
