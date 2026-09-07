import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { createWorkspace } from "./workspace.controller.js";
import { createWorkspaceInvite } from "../workspaceInvite/workspaceInvite.controller.js";
import { ResearchRoutes } from "../research/research.route.js";
import { DesignerRoutes } from "../designer/designer.route.js";

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

export const WorkspaceRoutes = router;
export default router;

