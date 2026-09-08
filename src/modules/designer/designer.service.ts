import { Prisma, ResearchStatus, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  DESIGNER_QUEUE_ACTIVE_STATUSES,
  GetDesignerWorkQueueQueryInput,
  ReportDesignIssueBodyInput,
} from "./designer.validation.js";
import {
  DesignerWorkQueueItem,
  DesignerWorkQueueResult,
  NOTIFICATION_TYPE_DESIGN_ISSUE_REPORTED,
  NOTIFICATION_TYPE_DESIGN_REVIEW_SUBMITTED,
  ReportDesignIssueResult,
  StartDesignWorkResult,
  SubmitDesignReviewResult,
  StartCorrectionResult,
} from "./designer.type.js";
import {
  ReviewImageDestroyer,
  ReviewImageUploadInput,
  ReviewImageUploader,
  deleteTemporaryReviewImage,
  uploadTemporaryReviewImage,
} from "./designer.review-storage.js";

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

    // 4. Double-start protection: startedAt already populated on this assignment
    if (currentAssignment.startedAt !== null) {
      throw new ApiError(409, "Design work has already been started");
    }

    // 5. Status validation: allowed for ASSIGNED (first start) or DESIGN_IN_PROGRESS (reassigned start)
    if (
      researchItem.status !== ResearchStatus.ASSIGNED &&
      researchItem.status !== ResearchStatus.DESIGN_IN_PROGRESS
    ) {
      throw new ApiError(
        409,
        `Cannot start design work for an item with status ${researchItem.status}`
      );
    }

    const now = new Date();

    // 6. If status is ASSIGNED, conditionally transition to DESIGN_IN_PROGRESS
    if (researchItem.status === ResearchStatus.ASSIGNED) {
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
  },
  {
    maxWait: 10000,
    timeout: 15000,
  });
};

// Atomically transitions an assigned research item to ISSUE_REPORTED and records a designer issue report.
export const reportAssignedDesignIssue = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string,
  input: ReportDesignIssueBodyInput
): Promise<ReportDesignIssueResult> => {
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
        isCurrent: true,
      },
    });

    if (!currentAssignment) {
      throw new ApiError(409, "No active assignment found for this research item");
    }

    // 3. Verify designer ownership of current assignment
    if (currentAssignment.designerId !== designerId) {
      throw new ApiError(403, "You are not assigned to this research item");
    }

    // 4. Status validation: allowed ONLY from ASSIGNED or DESIGN_IN_PROGRESS
    if (
      researchItem.status !== ResearchStatus.ASSIGNED &&
      researchItem.status !== ResearchStatus.DESIGN_IN_PROGRESS
    ) {
      throw new ApiError(
        409,
        `Cannot report an issue for research item with status ${researchItem.status}`
      );
    }

    const now = new Date();

    // 5. Conditional atomic update on ResearchItem status
    // Serializes concurrent requests on the ResearchItem row
    const updatedItemResult = await tx.researchItem.updateMany({
      where: {
        id: researchItemId,
        workspaceId,
        status: {
          in: [ResearchStatus.ASSIGNED, ResearchStatus.DESIGN_IN_PROGRESS],
        },
      },
      data: {
        status: ResearchStatus.ISSUE_REPORTED,
        updatedAt: now,
      },
    });

    if (updatedItemResult.count !== 1) {
      throw new ApiError(
        409,
        "Issue has already been reported or item status has changed"
      );
    }

    // 6. Post-lock re-check: verify current assignment is STILL owned by this designer
    // If concurrent admin reassignment committed before this update, isCurrent became false
    const stillCurrentAssignment = await tx.designAssignment.findFirst({
      where: {
        id: currentAssignment.id,
        researchItemId,
        designerId,
        isCurrent: true,
      },
      select: {
        id: true,
      },
    });

    if (!stillCurrentAssignment) {
      throw new ApiError(403, "You are not assigned to this research item");
    }

    // 7. Create IssueReport atomically
    const issueReport = await tx.issueReport.create({
      data: {
        researchItemId,
        reportedById: designerId,
        reason: input.reason,
        details: input.details ?? null,
      },
      select: {
        id: true,
        reason: true,
        details: true,
        createdAt: true,
      },
    });

    // 8. Find all ADMIN members in the same workspace to receive in-app notifications
    const adminMembers = await tx.workspaceMember.findMany({
      where: {
        workspaceId,
        roles: {
          has: WorkspaceRole.ADMIN,
        },
      },
      select: {
        userId: true,
      },
    });

    if (adminMembers.length === 0) {
      throw new ApiError(
        500,
        "No workspace administrator found to receive issue notification"
      );
    }

    // 9. Atomically create notifications for all admin recipients
    await tx.notification.createMany({
      data: adminMembers.map((admin) => ({
        userId: admin.userId,
        type: NOTIFICATION_TYPE_DESIGN_ISSUE_REPORTED,
        title: "Design Issue Reported",
        message: `A designer reported an issue (${input.reason}) on a research item`,
        researchItemId,
      })),
    });

    return {
      researchItem: {
        id: researchItem.id,
        status: ResearchStatus.ISSUE_REPORTED,
      },
      issueReport,
    };
  },
  {
    maxWait: 10000,
    timeout: 15000,
  });
};

// Atomically transitions an in-progress research item to DESIGN_REVIEW, records a ReviewSubmission, and notifies workspace admins.
export const submitAssignedDesignReview = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string,
  imageInput: ReviewImageUploadInput,
  note?: string,
  uploader?: ReviewImageUploader,
  destroyer?: ReviewImageDestroyer
): Promise<SubmitDesignReviewResult> => {
  // 1. Pre-upload state check (optimization before external upload)
  const precheckItem = await prisma.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!precheckItem) {
    throw new ApiError(404, "Research item not found");
  }

  if (precheckItem.status !== ResearchStatus.DESIGN_IN_PROGRESS) {
    throw new ApiError(
      409,
      `Cannot submit review for research item with status ${precheckItem.status}`
    );
  }

  const precheckAssignment = await prisma.designAssignment.findFirst({
    where: {
      researchItemId,
      isCurrent: true,
    },
    select: {
      id: true,
      designerId: true,
      startedAt: true,
    },
  });

  if (!precheckAssignment) {
    throw new ApiError(409, "No active assignment found for this research item");
  }

  if (precheckAssignment.designerId !== designerId) {
    throw new ApiError(403, "You are not assigned to this research item");
  }

  if (precheckAssignment.startedAt === null) {
    throw new ApiError(409, "Design work has not been started");
  }

  // 2. Upload review screenshot to Cloudinary (MUST occur OUTSIDE DB transaction)
  const uploadedImage = await uploadTemporaryReviewImage(imageInput, uploader);

  // 3. Authoritative DB transaction with rollback cleanup
  try {
    return await prisma.$transaction(
      async (tx) => {
        // Step A: Conditional status transition gate
        const updatedItemResult = await tx.researchItem.updateMany({
          where: {
            id: researchItemId,
            workspaceId,
            status: ResearchStatus.DESIGN_IN_PROGRESS,
          },
          data: {
            status: ResearchStatus.DESIGN_REVIEW,
            updatedAt: new Date(),
          },
        });

        if (updatedItemResult.count !== 1) {
          throw new ApiError(
            409,
            "Research item is not in DESIGN_IN_PROGRESS status or has already been submitted for review"
          );
        }

        // Step B: Post-gate assignment re-check to protect reassign race
        const stillCurrentAssignment = await tx.designAssignment.findFirst({
          where: {
            researchItemId,
            designerId,
            isCurrent: true,
          },
          select: {
            id: true,
            startedAt: true,
          },
        });

        if (!stillCurrentAssignment) {
          throw new ApiError(403, "You are not assigned to this research item");
        }

        if (stillCurrentAssignment.startedAt === null) {
          throw new ApiError(409, "Design work has not been started");
        }

        // Step C: Calculate server-side round number (latest existing round + 1)
        const latestSubmission = await tx.reviewSubmission.findFirst({
          where: { researchItemId },
          orderBy: { roundNumber: "desc" },
          select: { roundNumber: true },
        });

        const roundNumber = (latestSubmission?.roundNumber ?? 0) + 1;

        // Step D: Create ReviewSubmission record
        const normalizedNote = note?.trim() || null;
        const reviewSubmission = await tx.reviewSubmission.create({
          data: {
            researchItemId,
            designerId,
            roundNumber,
            imageUrl: uploadedImage.secureUrl,
            imagePublicId: uploadedImage.publicId,
            note: normalizedNote,
          },
          select: {
            id: true,
            roundNumber: true,
            imageUrl: true,
            note: true,
            submittedAt: true,
          },
        });

        // Step E: Query all ADMIN members of the same workspace
        const adminMembers = await tx.workspaceMember.findMany({
          where: {
            workspaceId,
            roles: {
              has: WorkspaceRole.ADMIN,
            },
          },
          select: {
            userId: true,
          },
        });

        if (adminMembers.length === 0) {
          throw new ApiError(
            500,
            "No workspace administrator found to receive review notification"
          );
        }

        // Step F: Fetch designer display name minimally for human notification message
        const designerUser = await tx.user.findUnique({
          where: { id: designerId },
          select: { name: true },
        });

        const designerDisplayName = designerUser?.name?.trim() || "A designer";

        // Step G: Create in-app notifications for all workspace admins
        await tx.notification.createMany({
          data: adminMembers.map((admin) => ({
            userId: admin.userId,
            type: NOTIFICATION_TYPE_DESIGN_REVIEW_SUBMITTED,
            title: "Design Submitted for Review",
            message: `${designerDisplayName} submitted review round ${roundNumber}.`,
            researchItemId,
          })),
        });

        return {
          researchItem: {
            id: researchItemId,
            status: ResearchStatus.DESIGN_REVIEW,
          },
          reviewSubmission: {
            id: reviewSubmission.id,
            roundNumber: reviewSubmission.roundNumber,
            imageUrl: reviewSubmission.imageUrl,
            note: reviewSubmission.note,
            submittedAt: reviewSubmission.submittedAt,
          },
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      }
    );
  } catch (error) {
    // Attempt cleanup of uploaded Cloudinary image on any DB failure
    try {
      await deleteTemporaryReviewImage(uploadedImage.publicId, destroyer);
    } catch {
      // Do not mask original error if cleanup fails
    }
    throw error;
  }
};

// Atomically transitions an item from CORRECTION_NEEDED to DESIGN_IN_PROGRESS and sets startedAt if not yet initialized.
export const startCorrection = async (
  workspaceId: string,
  researchItemId: string,
  designerId: string
): Promise<StartCorrectionResult> => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Scoped lookup: verify research item exists in the requested workspace
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

      // 2. Fetch current active design assignment
      const currentAssignment = await tx.designAssignment.findFirst({
        where: {
          researchItemId,
          isCurrent: true,
        },
        select: {
          id: true,
          designerId: true,
          startedAt: true,
        },
      });

      if (!currentAssignment || currentAssignment.designerId !== designerId) {
        throw new ApiError(403, "You are not assigned to this research item");
      }

      // 3. Status validation: source status must strictly be CORRECTION_NEEDED
      if (researchItem.status !== ResearchStatus.CORRECTION_NEEDED) {
        throw new ApiError(
          409,
          `Cannot start correction for an item with status ${researchItem.status}`
        );
      }

      const now = new Date();

      // 4. Concurrency gate: conditional atomic status transition on ResearchItem
      const updatedItemResult = await tx.researchItem.updateMany({
        where: {
          id: researchItemId,
          workspaceId,
          status: ResearchStatus.CORRECTION_NEEDED,
        },
        data: {
          status: ResearchStatus.DESIGN_IN_PROGRESS,
          updatedAt: now,
        },
      });

      if (updatedItemResult.count !== 1) {
        throw new ApiError(
          409,
          "Research item is not in CORRECTION_NEEDED status or has already been updated"
        );
      }

      // 5. Conditional startedAt initialization:
      // Case A: Continuing designer already has startedAt -> preserved as-is.
      // Case B: Newly reassigned designer has startedAt === null -> initialize to now.
      if (currentAssignment.startedAt === null) {
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
          throw new ApiError(
            409,
            "Design assignment has already been modified or reassigned"
          );
        }
      }

      // 6. Post-gate race verification: verify assignment is still current and owned by authenticated designer
      const recheckAssignment = await tx.designAssignment.findFirst({
        where: {
          id: currentAssignment.id,
          researchItemId,
          isCurrent: true,
        },
        select: {
          designerId: true,
        },
      });

      if (
        !recheckAssignment ||
        recheckAssignment.designerId !== designerId
      ) {
        throw new ApiError(
          403,
          "Design assignment changed concurrently during start correction"
        );
      }

      return {
        researchItem: {
          id: researchItem.id,
          status: ResearchStatus.DESIGN_IN_PROGRESS,
        },
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
};




