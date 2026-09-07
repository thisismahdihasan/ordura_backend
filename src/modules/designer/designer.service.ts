import { Prisma, ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  DESIGNER_QUEUE_ACTIVE_STATUSES,
  GetDesignerWorkQueueQueryInput,
} from "./designer.validation.js";
import {
  DesignerWorkQueueItem,
  DesignerWorkQueueResult,
  StartDesignWorkResult,
} from "./designer.type.js";

export const safeDesignerWorkQueueSelect = {
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
      updatedAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} as const;

// Retrieves current active design assignments for the authenticated designer in a workspace.
export const getDesignerWorkQueue = async (
  workspaceId: string,
  designerId: string,
  query: GetDesignerWorkQueueQueryInput
): Promise<DesignerWorkQueueResult> => {
  const { page, limit, status, search } = query;

  const researchItemWhere: Prisma.ResearchItemWhereInput = {
    workspaceId,
    status: status ? status : { in: [...DESIGNER_QUEUE_ACTIVE_STATUSES] },
  };

  if (search) {
    researchItemWhere.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { etsyListingId: { contains: search, mode: "insensitive" } },
      { normalizedUrl: { contains: search, mode: "insensitive" } },
      { originalUrl: { contains: search, mode: "insensitive" } },
    ];
  }

  const where: Prisma.DesignAssignmentWhereInput = {
    designerId,
    isCurrent: true,
    researchItem: researchItemWhere,
  };

  const skip = (page - 1) * limit;

  const [assignments, total] = await prisma.$transaction([
    prisma.designAssignment.findMany({
      where,
      select: safeDesignerWorkQueueSelect,
      orderBy: [
        { assignedAt: "desc" },
        { id: "desc" },
      ],
      skip,
      take: limit,
    }),
    prisma.designAssignment.count({ where }),
  ]);

  const items: DesignerWorkQueueItem[] = assignments.map((assignment) => ({
    assignmentId: assignment.id,
    assignedAt: assignment.assignedAt,
    startedAt: assignment.startedAt,
    researchItem: assignment.researchItem,
  }));

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

// Atomically transitions an assigned research item to in-progress and sets startedAt on the current assignment.
export const startDesignWork = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string
): Promise<StartDesignWorkResult> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Scoped lookup by item ID and workspace ID
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

    // 2. Fetch current assignment
    const currentAssignment = await tx.designAssignment.findFirst({
      where: {
        researchItemId,
        isCurrent: true,
      },
      select: {
        id: true,
        designerId: true,
        startedAt: true,
        isCurrent: true,
      },
    });

    if (!currentAssignment) {
      throw new ApiError(409, "No active assignment found for this research item");
    }

    // 3. Verify designer ownership of the current assignment
    if (currentAssignment.designerId !== designerId) {
      throw new ApiError(403, "You are not assigned to this research item");
    }

    // 4. Double-start protection: startedAt already populated
    if (currentAssignment.startedAt !== null) {
      throw new ApiError(409, "Design work has already been started");
    }

    // 5. Status validation: must be ASSIGNED
    if (researchItem.status !== ResearchStatus.ASSIGNED) {
      if (researchItem.status === ResearchStatus.DESIGN_IN_PROGRESS) {
        throw new ApiError(409, "Design work has already been started");
      }
      throw new ApiError(
        409,
        `Cannot start design work for an item with status ${researchItem.status}`
      );
    }

    // 6. Conditional atomic status update on ResearchItem
    const now = new Date();
    const updatedItemResult = await tx.researchItem.updateMany({
      where: {
        id: researchItemId,
        workspaceId,
        status: ResearchStatus.ASSIGNED,
      },
      data: {
        status: ResearchStatus.DESIGN_IN_PROGRESS,
        updatedAt: now,
      },
    });

    if (updatedItemResult.count === 0) {
      throw new ApiError(409, "Design work has already been started");
    }

    // 7. Conditional atomic update on DesignAssignment
    const updatedAssignmentResult = await tx.designAssignment.updateMany({
      where: {
        id: currentAssignment.id,
        researchItemId,
        designerId,
        isCurrent: true,
        startedAt: null,
      },
      data: {
        startedAt: now,
      },
    });

    if (updatedAssignmentResult.count !== 1) {
      throw new ApiError(409, "Design work has already been started");
    }

    return {
      researchItem: {
        id: researchItem.id,
        status: ResearchStatus.DESIGN_IN_PROGRESS,
      },
      assignment: {
        id: currentAssignment.id,
        designerId: currentAssignment.designerId,
        startedAt: now,
        isCurrent: true,
      },
    };
  });
};
