import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { create } from "./workspace.controller.js";
import { createInvite } from "../workspaceInvite/workspaceInvite.controller.js";
import { ResearchRoutes } from "../research/research.route.js";

const router: Router = Router();

router.post("/", requireAuth, catchAsync(create));
router.post(
  "/:workspaceId/invites",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(createInvite)
);
router.use("/:workspaceId/research-items", ResearchRoutes);

export const WorkspaceRoutes = router;
export default router;
