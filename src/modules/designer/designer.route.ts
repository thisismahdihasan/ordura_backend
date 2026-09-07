import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { getDesignerWorkQueue } from "./designer.controller.js";

const router: Router = Router({ mergeParams: true });

router.get(
  "/my-work",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.DESIGNER),
  catchAsync(getDesignerWorkQueue)
);

export const DesignerRoutes = router;
export default router;
