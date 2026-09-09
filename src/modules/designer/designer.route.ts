import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getDesignerWorkQueue,
  reportDesignIssue,
  startCorrection,
  startDesignWork,
  submitDesignReview,
  uploadFinalAssets,
  completeDesign,
} from "./designer.controller.js";
import { reviewImageUploadMiddleware } from "./designer.upload.js";
import { finalAssetsUploadMiddleware } from "./designer.final-asset-upload.js";

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

designRouter.post(
  "/:researchItemId/report-issue",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(reportDesignIssue)
);

designRouter.post(
  "/:researchItemId/review",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  reviewImageUploadMiddleware,
  catchAsync(submitDesignReview)
);

designRouter.post(
  "/:researchItemId/start-correction",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(startCorrection)
);

designRouter.post(
  "/:researchItemId/final-assets",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  finalAssetsUploadMiddleware,
  catchAsync(uploadFinalAssets)
);

designRouter.post(
  "/:researchItemId/complete",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(completeDesign)
);


export const DesignerRoutes = designerRouter;
export const DesignRoutes = designRouter;
export default designerRouter;

