import { z } from "zod";

export const googleDriveWorkspaceParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
  })
  .strict();

export type GoogleDriveWorkspaceParamsInput = z.infer<
  typeof googleDriveWorkspaceParamsSchema
>;

export const googleDriveCallbackQuerySchema = z
  .object({
    code: z.string().trim().min(1, "code cannot be empty").optional(),
    state: z.string().trim().min(1, "state cannot be empty").optional(),
    error: z.string().trim().optional(),
    error_description: z.string().trim().optional(),
  })
  .passthrough();

export type GoogleDriveCallbackQueryInput = z.infer<
  typeof googleDriveCallbackQuerySchema
>;
