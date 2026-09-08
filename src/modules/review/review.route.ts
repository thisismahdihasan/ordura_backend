import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { createReviewAnnotation } from "./review.controller.js";

const reviewRouter: Router = Router({ mergeParams: true });

reviewRouter.post(
  "/:reviewId/annotations",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(createReviewAnnotation)
);

export const ReviewRoutes = reviewRouter;
export default reviewRouter;
