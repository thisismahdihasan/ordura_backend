import { Prisma, ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { extractEtsyListing } from "../research/research.helper.js";
import { assignLeastWorkloadLister } from "./listing.assignment.js";
import { getObjectStream } from "../storage/r2.js";
import {
  BackfillListingResult,
  CompleteListingResult,
  FinalAssetDownloadDescriptor,
  ListerListingDetailResult,
  ListerWorkQueueItem,
  ListerWorkQueueResult,
  StartListingResult,
} from "./listing.type.js";
import {
  GetListerWorkQueueQueryInput,
  LISTER_QUEUE_ACTIVE_STATUSES,
  CompleteListingBodyInput,
} from "./listing.validation.js";

const LISTER_DOWNLOAD_STATUSES = new Set<ResearchStatus>([
  ResearchStatus.READY_FOR_LISTING,
  ResearchStatus.LISTING_IN_PROGRESS,
  ResearchStatus.LISTED,
]);

const LISTER_DETAIL_STATUSES = new Set<ResearchStatus>(
  LISTER_QUEUE_ACTIVE_STATUSES
);

export const safeListerWorkQueueSelect = {
  id: true,
  assignedAt: true,
  startedAt: true,
  researchItem: {
    select: {
      id: true,
      etsyListingId: true,
      originalUrl: true,
      normalizedUrl: true,
      title: true,
      referenceImageUrl: true,
      status: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      reviewSubmissions: {
        where: {
          approvedAt: { not: null },
        },
        orderBy: {
          roundNumber: "desc",
        },
        take: 1,
        select: {
          id: true,
          imageUrl: true,
          imageDeletedAt: true,
          roundNumber: true,
          approvedAt: true,
        },
      },
      finalAssets: {
        orderBy: {
          uploadedAt: "asc",
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
        },
      },
    },
  },
} as const;

// Retrieves the active work queue for an authenticated lister in a workspace.
export const getListerWorkQueue = async (
  workspaceId: string,
  listerId: string,
  query: GetListerWorkQueueQueryInput
): Promise<ListerWorkQueueResult> => {
  const { page, limit, status, search } = query;

  const researchItemWhere: Prisma.ResearchItemWhereInput = {
    workspaceId,
    status: status ? status : { in: [...LISTER_QUEUE_ACTIVE_STATUSES] },
  };

  if (search) {
    researchItemWhere.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { etsyListingId: { contains: search, mode: "insensitive" } },
      { normalizedUrl: { contains: search, mode: "insensitive" } },
      { originalUrl: { contains: search, mode: "insensitive" } },
    ];
  }

  const where: Prisma.ListingAssignmentWhereInput = {
    listerId,
    isCurrent: true,
    researchItem: researchItemWhere,
  };

  const skip = (page - 1) * limit;

  const [assignments, total] = await prisma.$transaction([
    prisma.listingAssignment.findMany({
      where,
      select: safeListerWorkQueueSelect,
      orderBy: [
        { assignedAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.listingAssignment.count({ where }),
  ]);

  const items: ListerWorkQueueItem[] = assignments.map((assignment) => {
    const rawPreview = assignment.researchItem.reviewSubmissions[0] ?? null;
    const preview = rawPreview && rawPreview.approvedAt
      ? {
          reviewId: rawPreview.id,
          imageUrl:
            rawPreview.imageDeletedAt === null ? rawPreview.imageUrl : null,
          imageDeletedAt: rawPreview.imageDeletedAt,
          roundNumber: rawPreview.roundNumber,
          approvedAt: rawPreview.approvedAt,
        }
      : null;

    return {
      assignmentId: assignment.id,
      assignedAt: assignment.assignedAt,
      startedAt: assignment.startedAt,
      researchItem: {
        id: assignment.researchItem.id,
        etsyListingId: assignment.researchItem.etsyListingId,
        originalUrl: assignment.researchItem.originalUrl,
        normalizedUrl: assignment.researchItem.normalizedUrl,
        title: assignment.researchItem.title,
        referenceImageUrl: assignment.researchItem.referenceImageUrl,
        status: assignment.researchItem.status,
        createdAt: assignment.researchItem.createdAt,
        createdBy: assignment.researchItem.createdBy,
      },
      preview,
      finalAssets: assignment.researchItem.finalAssets.map((asset) => ({
        id: asset.id,
        fileName: asset.fileName,
        fileSize: asset.fileSize.toString(),
        mimeType: asset.mimeType,
      })),
    };
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
};

// Retrieves active listing detail only for the current assigned lister.
export const getListerListingDetail = async (
  workspaceId: string,
  researchItemId: string,
  listerId: string
): Promise<ListerListingDetailResult> => {
  const researchItem = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      etsyListingId: true,
      title: true,
      originalUrl: true,
      normalizedUrl: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      designAssignments: {
        where: { isCurrent: true },
        orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          designer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      listingAssignments: {
        where: { isCurrent: true },
        orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          listerId: true,
          assignedAt: true,
          startedAt: true,
          completedAt: true,
          isCurrent: true,
        },
      },
      reviewSubmissions: {
        where: { approvedAt: { not: null } },
        orderBy: [{ roundNumber: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          id: true,
          roundNumber: true,
          imageUrl: true,
          imageDeletedAt: true,
          approvedAt: true,
        },
      },
      finalAssets: {
        orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!researchItem) {
    throw new ApiError(404, "Research item not found");
  }

  const listingAssignment = researchItem.listingAssignments[0] ?? null;
  if (!listingAssignment) {
    throw new ApiError(409, "No active assignment found for this research item");
  }

  if (listingAssignment.listerId !== listerId) {
    throw new ApiError(403, "You are not assigned to this research item");
  }

  if (!LISTER_DETAIL_STATUSES.has(researchItem.status)) {
    throw new ApiError(
      409,
      `Listing detail is not available for research item with status ${researchItem.status}`
    );
  }

  const rawApprovedPreview = researchItem.reviewSubmissions[0] ?? null;
  const approvedPreview = rawApprovedPreview?.approvedAt
    ? {
        reviewId: rawApprovedPreview.id,
        roundNumber: rawApprovedPreview.roundNumber,
        imageUrl:
          rawApprovedPreview.imageDeletedAt === null
            ? rawApprovedPreview.imageUrl
            : null,
        imageDeletedAt: rawApprovedPreview.imageDeletedAt,
        approvedAt: rawApprovedPreview.approvedAt,
      }
    : null;

  return {
    researchItem: {
      id: researchItem.id,
      etsyListingId: researchItem.etsyListingId,
      title: researchItem.title,
      originalUrl: researchItem.originalUrl,
      normalizedUrl: researchItem.normalizedUrl,
      status: researchItem.status,
      createdAt: researchItem.createdAt,
      updatedAt: researchItem.updatedAt,
    },
    creator: researchItem.createdBy,
    designer: researchItem.designAssignments[0]?.designer ?? null,
    listingAssignment: {
      id: listingAssignment.id,
      assignedAt: listingAssignment.assignedAt,
      startedAt: listingAssignment.startedAt,
      completedAt: listingAssignment.completedAt,
      isCurrent: listingAssignment.isCurrent,
    },
    approvedPreview,
    finalAssets: researchItem.finalAssets.map((asset) => ({
      id: asset.id,
      fileName: asset.fileName,
      fileSize: asset.fileSize.toString(),
      mimeType: asset.mimeType,
      uploadedAt: asset.uploadedAt,
    })),
  };
};

// Sequentially assigns unassigned READY_FOR_LISTING backlog items to eligible listers using least-workload logic.
// Strictly never redistributes or touches items with an existing current assignment.
export const backfillUnassignedListings = async (
  workspaceId: string
): Promise<BackfillListingResult> => {
  return await prisma.$transaction(
    async (tx) => {
      // Find all items in READY_FOR_LISTING status having zero current assignments
      const unassignedItems = await tx.researchItem.findMany({
        where: {
          workspaceId,
          status: ResearchStatus.READY_FOR_LISTING,
          listingAssignments: {
            none: {
              isCurrent: true,
            },
          },
        },
        select: {
          id: true,
        },
        orderBy: [
          { createdAt: "asc" },
          { id: "asc" },
        ],
      });

      const assignedItemIds: string[] = [];

      for (const item of unassignedItems) {
        const result = await assignLeastWorkloadLister(tx, workspaceId, item.id);
        if (result && result.isNew) {
          assignedItemIds.push(item.id);
        }
      }

      return {
        backfilledCount: assignedItemIds.length,
        assignedItemIds,
      };
    },
    {
      maxWait: 15000,
      timeout: 30000,
    }
  );
};

// Atomically transitions an assigned research item to in-progress and sets startedAt on the current listing assignment.
export const startListingWork = async (
  workspaceId: string,
  researchItemId: string,
  listerId: string
): Promise<StartListingResult> => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Authoritative transaction-level row lock on ResearchItem
      await tx.$executeRaw`SELECT id FROM "ResearchItem" WHERE id = ${researchItemId} FOR UPDATE`;

      // 2. Scoped lookup: verify research item exists in this workspace
      const researchItem = await tx.researchItem.findFirst({
        where: {
          id: researchItemId,
          workspaceId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!researchItem) {
        throw new ApiError(404, "Research item not found");
      }

      // 3. Status validation: allowed ONLY from READY_FOR_LISTING
      if (researchItem.status !== ResearchStatus.READY_FOR_LISTING) {
        throw new ApiError(
          409,
          `Cannot start listing for research item with status ${researchItem.status}`
        );
      }

      // 4. Fetch current assignment
      const currentAssignment = await tx.listingAssignment.findFirst({
        where: {
          researchItemId,
          isCurrent: true,
        },
        select: {
          id: true,
          listerId: true,
          startedAt: true,
        },
      });

      if (!currentAssignment) {
        throw new ApiError(
          409,
          "No active assignment found for this research item"
        );
      }

      // 5. Verify lister ownership of the current assignment
      if (currentAssignment.listerId !== listerId) {
        throw new ApiError(403, "You are not assigned to this research item");
      }

      // 6. Double-start protection: startedAt must be null
      if (currentAssignment.startedAt !== null) {
        throw new ApiError(409, "Listing work has already been started");
      }

      const now = new Date();

      // 7. Conditional atomic transition of ResearchItem status to LISTING_IN_PROGRESS
      const updatedItemResult = await tx.researchItem.updateMany({
        where: {
          id: researchItemId,
          workspaceId,
          status: ResearchStatus.READY_FOR_LISTING,
        },
        data: {
          status: ResearchStatus.LISTING_IN_PROGRESS,
          updatedAt: now,
        },
      });

      if (updatedItemResult.count !== 1) {
        throw new ApiError(
          409,
          "Listing work has already been started or status has changed"
        );
      }

      // 8. Conditional atomic update on current ListingAssignment
      const updatedAssignmentResult = await tx.listingAssignment.updateMany({
        where: {
          id: currentAssignment.id,
          researchItemId,
          listerId,
          isCurrent: true,
          startedAt: null,
        },
        data: {
          startedAt: now,
        },
      });

      if (updatedAssignmentResult.count !== 1) {
        throw new ApiError(409, "Listing work has already been started");
      }

      return {
        researchItem: {
          id: researchItem.id,
          status: ResearchStatus.LISTING_IN_PROGRESS,
        },
        assignment: {
          id: currentAssignment.id,
          startedAt: now,
        },
      };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );
};

// Resolves an authorized final-asset media stream without exposing storage identifiers or credentials.
export const getAuthorizedFinalAssetDownload = async (
  workspaceId: string,
  assetId: string,
  userId: string
): Promise<FinalAssetDownloadDescriptor> => {
  const asset = await prisma.finalAsset.findFirst({
    where: {
      id: assetId,
      researchItem: {
        workspaceId,
      },
    },
    select: {
      id: true,
      fileName: true,
      fileSize: true,
      mimeType: true,
      storageKey: true,
      researchItemId: true,
      researchItem: {
        select: {
          id: true,
          workspaceId: true,
          status: true,
        },
      },
    },
  });

  if (!asset) {
    throw new ApiError(404, "Final asset not found");
  }

  if (!LISTER_DOWNLOAD_STATUSES.has(asset.researchItem.status)) {
    throw new ApiError(409, "Final asset is not available at this workflow stage.");
  }

  const currentAssignment = await prisma.listingAssignment.findFirst({
    where: {
      researchItemId: asset.researchItemId,
      listerId: userId,
      isCurrent: true,
    },
    select: {
      id: true,
      listerId: true,
      isCurrent: true,
    },
  });

  if (!currentAssignment) {
    throw new ApiError(403, "You are not assigned to this research item");
  }

  const stream = await getObjectStream(asset.storageKey);

  return {
    fileName: asset.fileName,
    fileSize: asset.fileSize,
    mimeType: asset.mimeType,
    stream,
  };
};

// Atomically completes listing work, preserves assignment history, and creates the sole listing result.
export const completeListingWork = async (
  workspaceId: string,
  researchItemId: string,
  listerId: string,
  input: CompleteListingBodyInput
): Promise<CompleteListingResult> => {
  const etsyListingUrl = input.etsyListingUrl
    ? extractEtsyListing(input.etsyListingUrl).normalizedUrl
    : null;

  return await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT id FROM "ResearchItem" WHERE id = ${researchItemId} FOR UPDATE`;

      const researchItem = await tx.researchItem.findFirst({
        where: {
          id: researchItemId,
          workspaceId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!researchItem) {
        throw new ApiError(404, "Research item not found");
      }

      if (researchItem.status !== ResearchStatus.LISTING_IN_PROGRESS) {
        throw new ApiError(
          409,
          `Cannot complete listing for research item with status ${researchItem.status}`
        );
      }

      const currentAssignment = await tx.listingAssignment.findFirst({
        where: {
          researchItemId,
          isCurrent: true,
        },
        select: {
          id: true,
          listerId: true,
          startedAt: true,
          completedAt: true,
        },
      });

      if (!currentAssignment) {
        throw new ApiError(409, "No active assignment found for this research item");
      }

      if (currentAssignment.listerId !== listerId) {
        throw new ApiError(403, "You are not assigned to this research item");
      }

      if (currentAssignment.startedAt === null) {
        throw new ApiError(409, "Listing work has not been started");
      }

      if (currentAssignment.completedAt !== null) {
        throw new ApiError(409, "Listing work has already been completed");
      }

      const existingResult = await tx.listingResult.findUnique({
        where: { researchItemId },
        select: { id: true },
      });

      if (existingResult) {
        throw new ApiError(409, "A listing result already exists for this research item");
      }

      const now = new Date();
      const itemUpdate = await tx.researchItem.updateMany({
        where: {
          id: researchItemId,
          workspaceId,
          status: ResearchStatus.LISTING_IN_PROGRESS,
        },
        data: {
          status: ResearchStatus.LISTED,
          updatedAt: now,
        },
      });

      if (itemUpdate.count !== 1) {
        throw new ApiError(409, "Listing status has changed");
      }

      const assignmentUpdate = await tx.listingAssignment.updateMany({
        where: {
          id: currentAssignment.id,
          researchItemId,
          listerId,
          isCurrent: true,
          startedAt: { not: null },
          completedAt: null,
        },
        data: {
          completedAt: now,
        },
      });

      if (assignmentUpdate.count !== 1) {
        throw new ApiError(409, "Listing work has already been completed");
      }

      const listingResult = await tx.listingResult.create({
        data: {
          researchItemId,
          etsyListingUrl,
          listedById: listerId,
          listedAt: now,
        },
        select: {
          id: true,
          etsyListingUrl: true,
          listedAt: true,
        },
      });

      return {
        researchItem: {
          id: researchItem.id,
          status: ResearchStatus.LISTED,
        },
        assignment: {
          id: currentAssignment.id,
          completedAt: now,
        },
        listingResult,
      };
    },
    {
      maxWait: 10000,
      timeout: 20000,
    }
  );
};
