import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  getDashboardOverview,
  getDesignerPerformance,
  getListerPerformance,
  getResearcherPerformance,
} from "./dashboard.controller.js";

const router: Router = Router({ mergeParams: true });

router.get(
  "/dashboard/overview",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(getDashboardOverview)
);

router.get(
  "/dashboard/researchers",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(getResearcherPerformance)
);

router.get(
  "/dashboard/designers",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(getDesignerPerformance)
);

router.get(
  "/dashboard/listers",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(getListerPerformance)
);

export const DashboardRoutes = router;
export default router;
