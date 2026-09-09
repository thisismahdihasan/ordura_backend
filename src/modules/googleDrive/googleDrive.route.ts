import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import * as googleDriveController from "./googleDrive.controller.js";

const workspaceRouter: Router = Router({ mergeParams: true });

// GET /api/v1/workspaces/:workspaceId/google-drive/connect
workspaceRouter.get(
  "/connect",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(googleDriveController.getConnectUrl)
);

// GET /api/v1/workspaces/:workspaceId/google-drive/connection
workspaceRouter.get(
  "/connection",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(googleDriveController.getConnectionStatus)
);

const callbackRouter: Router = Router();

// GET /api/v1/google-drive/callback
callbackRouter.get(
  "/callback",
  catchAsync(googleDriveController.handleCallback)
);

export const GoogleDriveWorkspaceRoutes = workspaceRouter;
export const GoogleDriveCallbackRoutes = callbackRouter;
export default workspaceRouter;
