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
