import { ResearchStatus, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  CreateAnnotationReplyResult,
  CreateReviewAnnotationResult,
} from "./review.type.js";
import {
  CreateAnnotationReplyBodyInput,
  CreateReviewAnnotationBodyInput,
} from "./review.validation.js";

export const ALLOWED_ANNOTATION_REPLY_STATUSES = [
  ResearchStatus.DESIGN_REVIEW,
  ResearchStatus.CORRECTION_NEEDED,
  ResearchStatus.DESIGN_IN_PROGRESS,
] as const;

export type AllowedAnnotationReplyStatus =
  (typeof ALLOWED_ANNOTATION_REPLY_STATUSES)[number];

// Atomically creates an annotation on the current active review round for an admin.
export const createReviewAnnotation = async (
  workspaceId: string,
  reviewId: string,
  adminId: string,
  input: CreateReviewAnnotationBodyInput
): Promise<CreateReviewAnnotationResult> => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Scoped lookup: verify review belongs to a research item in this workspace
      const targetReview = await tx.reviewSubmission.findFirst({
        where: {
          id: reviewId,
          researchItem: {
            workspaceId,
          },
        },
        select: {
          id: true,
          researchItemId: true,
          roundNumber: true,
          researchItem: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });

      if (!targetReview) {
        throw new ApiError(404, "Review submission not found");
      }

      // 2. Status validation: annotations are only permitted when item is in DESIGN_REVIEW
      if (targetReview.researchItem.status !== ResearchStatus.DESIGN_REVIEW) {
        throw new ApiError(
          409,
          `Cannot add annotations when research item status is ${targetReview.researchItem.status}`
        );
      }

      // 3. Current review round rule: must be the latest review round for this research item
      const latestReview = await tx.reviewSubmission.findFirst({
        where: {
          researchItemId: targetReview.researchItemId,
        },
        orderBy: {
          roundNumber: "desc",
        },
        select: {
          id: true,
          roundNumber: true,
        },
      });

      if (!latestReview || latestReview.id !== targetReview.id) {
        throw new ApiError(
          409,
          "Annotations can only be added to the current review round"
        );
      }

      // 4. Create ReviewAnnotation record with default resolved = false
      const trimmedComment = input.comment.trim();
      if (!trimmedComment) {
        throw new ApiError(400, "comment cannot be empty");
      }

      const annotation = await tx.reviewAnnotation.create({
        data: {
          reviewSubmissionId: targetReview.id,
          createdById: adminId,
          x: input.x,
          y: input.y,
          comment: trimmedComment,
        },
        select: {
          id: true,
          reviewSubmissionId: true,
          x: true,
          y: true,
          comment: true,
          resolved: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        annotation,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
};

// Atomically creates a threaded reply on an annotation belonging to the current active review round.
export const createAnnotationReply = async (
  workspaceId: string,
  annotationId: string,
  userId: string,
  input: CreateAnnotationReplyBodyInput
): Promise<CreateAnnotationReplyResult> => {
  return await prisma.$transaction(
    async (tx) => {
      // 1. Scoped lookup: verify annotation belongs to a research item in this workspace
      const targetAnnotation = await tx.reviewAnnotation.findFirst({
        where: {
          id: annotationId,
          reviewSubmission: {
            researchItem: {
              workspaceId,
            },
          },
        },
        select: {
          id: true,
          reviewSubmissionId: true,
          reviewSubmission: {
            select: {
              id: true,
              researchItemId: true,
              roundNumber: true,
              researchItem: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      if (!targetAnnotation) {
        throw new ApiError(404, "Annotation not found");
      }

      // 2. Authoritative role check: workspace membership
      const member = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
        select: {
          roles: true,
        },
      });

      if (!member) {
        throw new ApiError(403, "You do not have access to this workspace");
      }

      const isAdmin = member.roles.includes(WorkspaceRole.ADMIN);
      const isDesigner = member.roles.includes(WorkspaceRole.DESIGNER);

      if (!isAdmin && !isDesigner) {
        throw new ApiError(403, "Insufficient workspace permissions");
      }

      // 3. Designer assignment verification (ADMIN is independently sufficient)
      if (!isAdmin) {
        const currentAssignment = await tx.designAssignment.findFirst({
          where: {
            researchItemId: targetAnnotation.reviewSubmission.researchItemId,
            isCurrent: true,
          },
          select: {
            id: true,
            designerId: true,
          },
        });

        if (!currentAssignment || currentAssignment.designerId !== userId) {
          throw new ApiError(403, "You are not assigned to this research item");
        }
      }

      // 4. Workflow status validation: allowed on DESIGN_REVIEW, CORRECTION_NEEDED, DESIGN_IN_PROGRESS
      const itemStatus = targetAnnotation.reviewSubmission.researchItem.status;
      if (
        !(ALLOWED_ANNOTATION_REPLY_STATUSES as readonly ResearchStatus[]).includes(
          itemStatus
        )
      ) {
        throw new ApiError(
          409,
          `Cannot add replies when research item status is ${itemStatus}`
        );
      }

      // 5. Current review round rule: must belong to the latest review round for this research item
      const latestReview = await tx.reviewSubmission.findFirst({
        where: {
          researchItemId: targetAnnotation.reviewSubmission.researchItemId,
        },
        orderBy: {
          roundNumber: "desc",
        },
        select: {
          id: true,
          roundNumber: true,
        },
      });

      if (
        !latestReview ||
        latestReview.id !== targetAnnotation.reviewSubmissionId
      ) {
        throw new ApiError(
          409,
          "Replies can only be added to annotations on the current review round"
        );
      }

      // 6. Create AnnotationReply record
      const trimmedMessage = input.message.trim();
      if (!trimmedMessage) {
        throw new ApiError(400, "message cannot be empty");
      }

      const reply = await tx.annotationReply.create({
        data: {
          annotationId: targetAnnotation.id,
          createdById: userId,
          message: trimmedMessage,
        },
        select: {
          id: true,
          annotationId: true,
          message: true,
          createdAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return {
        reply,
      };
    },
    {
      maxWait: 10000,
      timeout: 15000,
    }
  );
};
