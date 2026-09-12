import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { GetNotificationsQueryInput } from "./notification.validation.js";
import {
  MarkAllNotificationsReadResult,
  MarkNotificationReadResult,
  NotificationListResult,
} from "./notification.type.js";

export const getMyNotifications = async (
  userId: string,
  workspaceId: string,
  query: GetNotificationsQueryInput
): Promise<NotificationListResult> => {
  const where = { userId, workspaceId };
  const [rows, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: {
        id: true,
        workspaceId: true,
        type: true,
        title: true,
        message: true,
        researchItemId: true,
        isRead: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, workspaceId, isRead: false } }),
  ]);
  return {
    items: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
    unreadCount,
  };
};

export const markMyNotificationRead = async (
  userId: string,
  workspaceId: string,
  notificationId: string
): Promise<MarkNotificationReadResult> => {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId, workspaceId },
    select: { id: true, isRead: true },
  });
  if (!notification) throw new ApiError(404, "Notification not found");
  if (!notification.isRead) {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId, workspaceId, isRead: false },
      data: { isRead: true },
    });
  }
  return { id: notification.id, isRead: true };
};

export const markAllMyNotificationsRead = async (
  userId: string,
  workspaceId: string
): Promise<MarkAllNotificationsReadResult> => {
  const result = await prisma.notification.updateMany({
    where: { userId, workspaceId, isRead: false },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
};
