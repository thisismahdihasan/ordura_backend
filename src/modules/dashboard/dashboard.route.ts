import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { getDashboardOverview } from "./dashboard.controller.js";

const router: Router = Router({ mergeParams: true });

router.get(
  "/dashboard/overview",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(getDashboardOverview)
);

export const DashboardRoutes = router;
export default router;
