import express, { Router } from "express";
import { HealthRoutes } from "../modules/health/health.route.js";
import { AuthRoutes } from "../modules/auth/auth.route.js";
import { WorkspaceRoutes } from "../modules/workspace/workspace.route.js";
import { WorkspaceInviteRoutes } from "../modules/workspaceInvite/workspaceInvite.route.js";
import { GoogleDriveCallbackRoutes } from "../modules/googleDrive/googleDrive.route.js";
import { NotificationRoutes } from "../modules/notification/notification.route.js";

const router: Router = express.Router();

type ModuleRoute = {
  path: string;
  route: Router;
};

const moduleRoutes: ModuleRoute[] = [
  {
    path: "/health",
    route: HealthRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/workspaces",
    route: WorkspaceRoutes,
  },
  {
    path: "/workspace/invites",
    route: WorkspaceInviteRoutes,
  },
  {
    path: "/google-drive",
    route: GoogleDriveCallbackRoutes,
  },
  {
    path: "/notifications",
    route: NotificationRoutes,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
