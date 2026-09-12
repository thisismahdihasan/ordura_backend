import { z } from "zod";

export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict();

export type GetNotificationsQueryInput = z.infer<typeof getNotificationsQuerySchema>;

export const notificationWorkspaceParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
  })
  .strict();

export const markNotificationReadParamsSchema = z
  .object({
    notificationId: z.string().trim().min(1, "notificationId is required"),
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
  })
  .strict();

export const emptyNotificationBodySchema = z.object({}).strict().default({});
