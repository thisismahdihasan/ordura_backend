import { ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { CreateReviewAnnotationResult } from "./review.type.js";
import { CreateReviewAnnotationBodyInput } from "./review.validation.js";

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
