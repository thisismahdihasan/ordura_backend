import { z } from "zod";
import { WorkspaceRole } from "@prisma/client";

export const createWorkspaceInviteSchema = z.object({
  email: z
    .string({ message: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  roles: z
    .array(z.nativeEnum(WorkspaceRole), {
      message: "Roles must be an array of valid workspace roles",
    })
    .min(1, "At least one role must be specified")
    .refine((roles) => new Set(roles).size === roles.length, {
      message: "Duplicate roles are not allowed",
    }),
});

export type CreateWorkspaceInviteInput = z.infer<typeof createWorkspaceInviteSchema>;

export const listWorkspaceInvitesQuerySchema = z.object({
  status: z.literal("pending").optional(),
});

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const workspaceInviteIdParamsSchema = z.object({
  inviteId: z.string().trim().min(1, "Invite ID is required"),
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
});

export const acceptWorkspaceInviteParamsSchema = z.object({
  token: z
    .string({ message: "Invitation token is required" })
    .trim()
    .min(1, "Invitation token cannot be empty"),
});

export type AcceptWorkspaceInviteParams = z.infer<
  typeof acceptWorkspaceInviteParamsSchema
>;
