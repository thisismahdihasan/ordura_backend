import { Prisma, ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { assignLeastWorkloadLister } from "./listing.assignment.js";
import {
  BackfillListingResult,
  ListerWorkQueueItem,
  ListerWorkQueueResult,
} from "./listing.type.js";
import {
  GetListerWorkQueueQueryInput,
  LISTER_QUEUE_ACTIVE_STATUSES,
} from "./listing.validation.js";

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
          imageUrl: true,
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
          imageUrl: rawPreview.imageUrl,
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
