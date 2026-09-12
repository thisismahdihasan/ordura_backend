import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceMember } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification.controller.js";
const router: Router = Router({ mergeParams: true });
router.use(requireAuth, requireWorkspaceMember);
router.get("/", catchAsync(getNotifications));
router.patch("/read-all", catchAsync(markAllNotificationsRead));
router.patch("/:notificationId/read", catchAsync(markNotificationRead));
export const NotificationRoutes = router;
export default router;
