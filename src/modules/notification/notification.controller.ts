import { Request, Response } from "express";
import { AuthenticatedRequest } from "../../middleware/requireAuth.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as service from "./notification.service.js";
import { emptyNotificationBodySchema, getNotificationsQuerySchema, markNotificationReadParamsSchema } from "./notification.validation.js";

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const result = await service.getMyNotifications((req as AuthenticatedRequest).user.id, getNotificationsQuerySchema.parse(req.query));
  ApiResponse.success(res, { message: "Notifications retrieved successfully", data: result });
};
export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  const { notificationId } = markNotificationReadParamsSchema.parse(req.params);
  emptyNotificationBodySchema.parse(req.body);
  const result = await service.markMyNotificationRead((req as AuthenticatedRequest).user.id, notificationId);
  ApiResponse.success(res, { message: "Notification marked as read", data: result });
};
export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  emptyNotificationBodySchema.parse(req.body);
  const result = await service.markAllMyNotificationsRead((req as AuthenticatedRequest).user.id);
  ApiResponse.success(res, { message: "Notifications marked as read", data: result });
};
