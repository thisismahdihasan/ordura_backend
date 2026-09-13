import { Router } from "express";
import { WorkspaceRole } from "@prisma/client";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireWorkspaceRole } from "../../middleware/requireWorkspaceRole.js";
import { catchAsync } from "../../utils/catchAsync.js";
import {
  backfillListingAssignments,
  completeListing,
  downloadFinalAsset,
  getListerListingDetail,
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

listingRouter.get(
  "/assets/:assetId/download",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.LISTER),
  catchAsync(downloadFinalAsset)
);

listingRouter.get(
  "/:researchItemId",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.LISTER),
  catchAsync(getListerListingDetail)
);

listingRouter.post(
  "/:researchItemId/complete",
  requireAuth,
  requireWorkspaceRole(WorkspaceRole.LISTER),
  catchAsync(completeListing)
);

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
