import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  backfillListingAssignments,
  getListerWorkQueue,
  startListing,
} from "./listing.controller.js";

const listerRouter: Router = Router({ mergeParams: true });

listerRouter.get(
  "/my-work",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.LISTER),
  catchAsync(getListerWorkQueue)
);

const listingRouter: Router = Router({ mergeParams: true });

listingRouter.post(
  "/:researchItemId/start",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.LISTER),
  catchAsync(startListing)
);

listingRouter.post(
  "/backfill-assignments",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.ADMIN),
  catchAsync(backfillListingAssignments)
);

export const ListerRoutes = listerRouter;
export const ListingRoutes = listingRouter;
export default listerRouter;
