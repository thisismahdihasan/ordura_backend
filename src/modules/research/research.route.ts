import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { create } from "./research.controller.js";

const router: Router = Router({ mergeParams: true });

router.post(
  "/",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.RESEARCHER),
  catchAsync(create)
);

export const ResearchRoutes = router;
export default router;
