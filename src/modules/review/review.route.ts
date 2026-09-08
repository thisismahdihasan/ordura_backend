import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  createAnnotationReply,
  createReviewAnnotation,
} from "./review.controller.js";

const reviewRouter: Router = Router({ mergeParams: true });

reviewRouter.post(
  "/:reviewId/annotations",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(createReviewAnnotation)
);

const annotationRouter: Router = Router({ mergeParams: true });

annotationRouter.post(
  "/:annotationId/replies",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN, WorkspaceRole.DESIGNER),
  catchAsync(createAnnotationReply)
);

export const ReviewRoutes = reviewRouter;
export const AnnotationRoutes = annotationRouter;
export default reviewRouter;
