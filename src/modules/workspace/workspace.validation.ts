import { WorkspaceRole } from "@prisma/client";
import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string({ message: "Workspace name is required" })
    .trim()
    .min(1, "Workspace name cannot be empty")
    .max(100, "Workspace name must be at most 100 characters long"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().trim().min(1, "Workspace ID is required"),
}).strict();

export const workspaceMemberParamsSchema = workspaceIdParamsSchema.extend({
  userId: z.string().trim().min(1, "User ID is required"),
}).strict();

export const updateWorkspaceMemberRolesSchema = z.object({
  roles: z
    .array(z.enum(WorkspaceRole))
    .min(1, "At least one workspace role is required")
    .refine(
      (roles) => new Set(roles).size === roles.length,
      "Workspace roles must be unique"
    ),
}).strict();

export type UpdateWorkspaceMemberRolesInput = z.infer<
  typeof updateWorkspaceMemberRolesSchema
>;
