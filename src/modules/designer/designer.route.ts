import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getDesignerWorkQueue,
  startDesignWork,
} from "./designer.controller.js";

const designerRouter: Router = Router({ mergeParams: true });

designerRouter.get(
  "/my-work",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(getDesignerWorkQueue)
);

const designRouter: Router = Router({ mergeParams: true });

designRouter.post(
  "/:researchItemId/start",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(startDesignWork)
);

export const DesignerRoutes = designerRouter;
export const DesignRoutes = designRouter;
export default designerRouter;
