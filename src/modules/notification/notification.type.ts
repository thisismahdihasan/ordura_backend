export type NotificationListItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  researchItemId: string | null;
  workspaceId: string | null;
  isRead: boolean;
  createdAt: Date;
};

export type NotificationListResult = {
  items: NotificationListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  unreadCount: number;
};

export type MarkNotificationReadResult = { id: string; isRead: boolean };
export type MarkAllNotificationsReadResult = { updatedCount: number };

export const NOTIFICATION_TYPE_DESIGN_ASSIGNED = "DESIGN_ASSIGNED" as const;
