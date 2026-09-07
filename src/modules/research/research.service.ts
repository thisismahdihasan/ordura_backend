import { Prisma, ResearchStatus, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { extractEtsyListing } from "./research.helper.js";
import { fetchEtsyMetadata } from "./research.metadata.js";
import { findLeastWorkloadDesigner } from "./research.assignment.js";
import {
  CreateResearchItemInput,
  GetResearchItemsQueryInput,
} from "./research.validation.js";
import {
  DuplicateResearchItemData,
  EtsyMetadata,
  ReassignedResearchItemData,
  ResearchItemListResult,
  SafeResearchItem,
  SafeResearchItemDetail,
} from "./research.type.js";

export const safeResearchItemSelect = {
  id: true,
  workspaceId: true,
  etsyListingId: true,
  originalUrl: true,
  normalizedUrl: true,
  title: true,
  referenceImageUrl: true,
  status: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

const duplicateResearchItemSelect = {
  id: true,
  status: true,
  createdAt: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export type CreateResearchItemOptions = {
  metadataFetcher?: (url: string) => Promise<EtsyMetadata>;
};

// Creates a new research item, parses metadata, and atomically auto-assigns the least-loaded designer.
export const createResearchItem = async (
  workspaceId: string,
  userId: string,
  input: CreateResearchItemInput,
  options?: CreateResearchItemOptions
): Promise<SafeResearchItem> => {
  const { originalUrl, normalizedUrl, etsyListingId } = extractEtsyListing(
    input.etsyUrl
  );

  // 1. Readable duplicate pre-check within the same workspace
  const existingItem = await prisma.researchItem.findUnique({
    where: {
      workspaceId_etsyListingId: {
        workspaceId,
        etsyListingId,
      },
    },
    select: duplicateResearchItemSelect,
  });

  if (existingItem) {
    const duplicateData: DuplicateResearchItemData = {
      alreadyExists: true,
      researchItemId: existingItem.id,
      createdBy: existingItem.createdBy,
      currentStatus: existingItem.status,
      createdAt: existingItem.createdAt,
    };

    throw new ApiError(
      409,
      "This Etsy listing has already been added to this workspace",
      true,
      "",
      duplicateData
    );
  }

  // 2. Best-effort metadata fetch only for NEW items
  let metadata: EtsyMetadata = { title: null, referenceImageUrl: null };
  try {
    const metadataFetcher = options?.metadataFetcher ?? fetchEtsyMetadata;
    metadata = await metadataFetcher(normalizedUrl);
  } catch {
    metadata = { title: null, referenceImageUrl: null };
  }

  // 3. Atomically create ResearchItem and auto-assign eligible designer if available
  try {
    const createdItem = await prisma.$transaction(async (tx) => {
      const chosenDesignerId = await findLeastWorkloadDesigner(
        tx,
        workspaceId
      );

      const initialStatus = chosenDesignerId
        ? ResearchStatus.ASSIGNED
        : ResearchStatus.RESEARCHED;

      const item = await tx.researchItem.create({
        data: {
          workspaceId,
          etsyListingId,
          originalUrl,
          normalizedUrl,
          title: metadata.title,
          referenceImageUrl: metadata.referenceImageUrl,
          createdById: userId,
          status: initialStatus,
        },
        select: safeResearchItemSelect,
      });

      if (chosenDesignerId) {
        await tx.designAssignment.create({
          data: {
            researchItemId: item.id,
            designerId: chosenDesignerId,
            isCurrent: true,
          },
          select: { id: true },
        });
      }

      return item;
    });

    return createdItem;
  } catch (error) {
    // Catch concurrent duplicate creation race condition (P2002)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const concurrentItem = await prisma.researchItem.findUnique({
        where: {
          workspaceId_etsyListingId: {
            workspaceId,
            etsyListingId,
          },
        },
        select: duplicateResearchItemSelect,
      });

      const duplicateData: DuplicateResearchItemData = {
        alreadyExists: true,
        researchItemId: concurrentItem?.id ?? "",
        createdBy: concurrentItem?.createdBy ?? {
          id: "",
          name: "",
          email: "",
        },
        currentStatus: concurrentItem?.status ?? ResearchStatus.RESEARCHED,
        createdAt: concurrentItem?.createdAt ?? new Date(),
      };

      throw new ApiError(
        409,
        "This Etsy listing has already been added to this workspace",
        true,
        "",
        duplicateData
      );
    }

    throw error;
  }
};

export const safeResearchItemListSelect = {
  id: true,
  workspaceId: true,
  etsyListingId: true,
  originalUrl: true,
  normalizedUrl: true,
  title: true,
  referenceImageUrl: true,
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
} as const;

// Returns a paginated list of workspace research items matching creator, status, date, or search filters.
export const getResearchItems = async (
  workspaceId: string,
  query: GetResearchItemsQueryInput
): Promise<ResearchItemListResult> => {
  const { page, limit, createdBy, status, date, search } = query;

  const where: Prisma.ResearchItemWhereInput = {
    workspaceId,
  };

  if (createdBy) {
    where.createdById = createdBy;
  }

  if (status) {
    where.status = status;
  }

  if (date) {
    const [year, month, day] = date.split("-").map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    where.createdAt = {
      gte: startOfDay,
      lt: nextDay,
    };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { etsyListingId: { contains: search, mode: "insensitive" } },
      { normalizedUrl: { contains: search, mode: "insensitive" } },
      { originalUrl: { contains: search, mode: "insensitive" } },
    ];
  }

  const skip = (page - 1) * limit;

  const [items, total] = await prisma.$transaction([
    prisma.researchItem.findMany({
      where,
      select: safeResearchItemListSelect,
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.researchItem.count({ where }),
  ]);

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

// Fetches details for a single research item scoped strictly to the specified workspace.
export const getResearchItemById = async (
  workspaceId: string,
  researchItemId: string
): Promise<SafeResearchItemDetail> => {
  const researchItem = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: safeResearchItemListSelect,
  });

  if (!researchItem) {
    throw new ApiError(404, "Research item not found");
  }

  return researchItem;
};

// Retrieves the stored reference image URL for an item after verifying workspace access.
export const getReferenceImageData = async (
  workspaceId: string,
  researchItemId: string
): Promise<{ id: string; referenceImageUrl: string }> => {
  const item = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      referenceImageUrl: true,
    },
  });

  if (!item) {
    throw new ApiError(404, "Research item not found");
  }

  if (!item.referenceImageUrl || item.referenceImageUrl.trim() === "") {
    throw new ApiError(404, "Reference image not available");
  }

  return {
    id: item.id,
    referenceImageUrl: item.referenceImageUrl.trim(),
  };
};

export const REASSIGNABLE_STATUSES: ResearchStatus[] = [
  ResearchStatus.RESEARCHED,
  ResearchStatus.ASSIGNED,
  ResearchStatus.DESIGN_IN_PROGRESS,
  ResearchStatus.DESIGN_REVIEW,
  ResearchStatus.CORRECTION_NEEDED,
  ResearchStatus.ISSUE_REPORTED,
];

// Atomically reassigns an in-flight research item to another workspace designer, preserving assignment history.
export const reassignResearchDesigner = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string
): Promise<ReassignedResearchItemData> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Serialize/lock row and verify item existence within workspace
    let lockedItem;
    try {
      lockedItem = await tx.researchItem.update({
        where: {
          id: researchItemId,
          workspaceId,
        },
        data: { updatedAt: new Date() },
        select: { id: true, status: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new ApiError(404, "Research item not found");
      }
      throw error;
    }

    // 2. Status eligibility check on fresh/locked state
    if (!REASSIGNABLE_STATUSES.includes(lockedItem.status)) {
      throw new ApiError(409, "Research item can no longer be reassigned");
    }

    // 4. Validate target designer in same workspace
    const targetMember = await tx.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: designerId,
        },
      },
      select: {
        userId: true,
        roles: true,
      },
    });

    if (!targetMember || !targetMember.roles.includes(WorkspaceRole.DESIGNER)) {
      throw new ApiError(
        400,
        "Selected user is not a designer in this workspace"
      );
    }

    // 5. Inspect current assignment
    const currentAssignment = await tx.designAssignment.findFirst({
      where: {
        researchItemId,
        isCurrent: true,
      },
      select: {
        id: true,
        designerId: true,
      },
    });

    // 6. Same designer conflict check
    if (currentAssignment && currentAssignment.designerId === designerId) {
      throw new ApiError(
        409,
        "Research item is already assigned to this designer"
      );
    }

    // 7. Mark existing current assignment historical
    if (currentAssignment) {
      await tx.designAssignment.updateMany({
        where: {
          researchItemId,
          isCurrent: true,
        },
        data: {
          isCurrent: false,
        },
      });
    }

    // 8. Create new current assignment
    const newAssignment = await tx.designAssignment.create({
      data: {
        researchItemId,
        designerId,
        isCurrent: true,
      },
      select: {
        id: true,
        designerId: true,
        assignedAt: true,
        isCurrent: true,
      },
    });

    // 9. Status transition logic
    let finalStatus = lockedItem.status;
    if (lockedItem.status === ResearchStatus.RESEARCHED) {
      await tx.researchItem.update({
        where: { id: researchItemId },
        data: { status: ResearchStatus.ASSIGNED },
      });
      finalStatus = ResearchStatus.ASSIGNED;
    }

    return {
      researchItem: {
        id: lockedItem.id,
        status: finalStatus,
      },
      assignment: newAssignment,
    };
  });
};

