import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  createResearchItem,
  deleteResearchItem,
  getResearchItemById,
  getResearchItems,
  getResearchReferenceImage,
  previewResearchItem,
  reassignResearchDesigner,
  updateResearchItem,
  uploadResearchReferenceImage,
} from "./research.controller.js";
import { referenceImageUploadMiddleware } from "./research.upload.js";

const router: Router = Router({ mergeParams: true });

router.post(
  "/preview",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.RESEARCHER),
  catchAsync(previewResearchItem)
);

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

router.post(
  "/:researchItemId/reference-image",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.RESEARCHER),
  referenceImageUploadMiddleware,
  catchAsync(uploadResearchReferenceImage)
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

router.patch(
  "/:researchItemId",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(updateResearchItem)
);

router.delete(
  "/:researchItemId",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(deleteResearchItem)
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

