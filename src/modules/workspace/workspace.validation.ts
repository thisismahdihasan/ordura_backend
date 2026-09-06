import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string({ message: "Workspace name is required" })
    .trim()
    .min(1, "Workspace name cannot be empty")
    .max(100, "Workspace name must be at most 100 characters long"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
