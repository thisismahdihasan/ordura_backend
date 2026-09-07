import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  createResearchItem,
  getResearchItemById,
  getResearchItems,
  getResearchReferenceImage,
  reassignResearchDesigner,
} from "./research.controller.js";

const router: Router = Router({ mergeParams: true });

router.post(
  "/",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.RESEARCHER),
  catchAsync(createResearchItem)
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
  catchAsync(getResearchItems)
);

router.patch(
  "/:researchItemId/designer",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(reassignResearchDesigner)
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
  catchAsync(getResearchReferenceImage)
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
  catchAsync(getResearchItemById)
);

export const ResearchRoutes = router;
export default router;

