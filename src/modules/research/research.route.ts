import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { create, getById, getReferenceImage, list } from "./research.controller.js";

const router: Router = Router({ mergeParams: true });

router.post(
  "/",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.RESEARCHER),
  catchAsync(create)
);

router.get(
  "/",
  requireAuth,
  requireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.RESEARCHER,
    WorkspaceRole.DESIGNER,
    WorkspaceRole.LISTER
  ),
  catchAsync(list)
);

router.get(
  "/:researchItemId/reference-image",
  requireAuth,
  requireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.RESEARCHER,
    WorkspaceRole.DESIGNER,
    WorkspaceRole.LISTER
  ),
  catchAsync(getReferenceImage)
);

router.get(
  "/:researchItemId",
  requireAuth,
  requireWorkspaceRole(
    WorkspaceRole.ADMIN,
    WorkspaceRole.RESEARCHER,
    WorkspaceRole.DESIGNER,
    WorkspaceRole.LISTER
  ),
  catchAsync(getById)
);

export const ResearchRoutes = router;
export default router;
