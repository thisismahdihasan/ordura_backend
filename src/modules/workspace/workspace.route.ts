import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { createWorkspace } from "./workspace.controller.js";
import { createWorkspaceInvite } from "../workspaceInvite/workspaceInvite.controller.js";
import { ResearchRoutes } from "../research/research.route.js";
import { DesignerRoutes, DesignRoutes } from "../designer/designer.route.js";
import { ReviewRoutes, AnnotationRoutes } from "../review/review.route.js";
import { GoogleDriveWorkspaceRoutes } from "../googleDrive/googleDrive.route.js";
import { ListerRoutes, ListingRoutes } from "../listing/listing.route.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(createWorkspace));
router.post(
  "/:workspaceId/invites",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(createWorkspaceInvite)
);
router.use("/:workspaceId/research-items", ResearchRoutes);
router.use("/:workspaceId/designer", DesignerRoutes);
router.use("/:workspaceId/design", DesignRoutes);
router.use("/:workspaceId/reviews", ReviewRoutes);
router.use("/:workspaceId/annotations", AnnotationRoutes);
router.use("/:workspaceId/google-drive", GoogleDriveWorkspaceRoutes);
router.use("/:workspaceId/lister", ListerRoutes);
router.use("/:workspaceId/listing", ListingRoutes);

export const WorkspaceRoutes = router;
export default router;

