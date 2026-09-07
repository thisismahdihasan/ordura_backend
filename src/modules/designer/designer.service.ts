import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  DESIGNER_QUEUE_ACTIVE_STATUSES,
  GetDesignerWorkQueueQueryInput,
} from "./designer.validation.js";
import {
  DesignerWorkQueueItem,
  DesignerWorkQueueResult,
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
