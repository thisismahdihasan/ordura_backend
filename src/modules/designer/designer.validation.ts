import { z } from "zod";
import { ResearchStatus } from "@prisma/client";

export const DESIGNER_QUEUE_ACTIVE_STATUSES = [
  ResearchStatus.ASSIGNED,
  ResearchStatus.DESIGN_IN_PROGRESS,
  ResearchStatus.DESIGN_REVIEW,
  ResearchStatus.CORRECTION_NEEDED,
  ResearchStatus.ISSUE_REPORTED,
] as const;

export type DesignerQueueActiveStatus =
  (typeof DESIGNER_QUEUE_ACTIVE_STATUSES)[number];

export const getDesignerWorkQueueQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int("page must be an integer")
      .positive("page must be a positive integer")
      .default(1),
    limit: z.coerce
      .number()
      .int("limit must be an integer")
      .positive("limit must be a positive integer")
      .max(100, "limit cannot exceed 100")
      .default(20),
    status: z
      .nativeEnum(ResearchStatus, {
        message: "Invalid status filter",
      })
      .refine(
        (val): val is DesignerQueueActiveStatus =>
          (DESIGNER_QUEUE_ACTIVE_STATUSES as readonly ResearchStatus[]).includes(val),
        {
          message:
            "Invalid status filter. Allowed values: ASSIGNED, DESIGN_IN_PROGRESS, DESIGN_REVIEW, CORRECTION_NEEDED, ISSUE_REPORTED",
        }
      )
      .optional(),
    search: z
      .string()
      .trim()
      .transform((val) => (val.length > 0 ? val : undefined))
      .optional(),
  })
  .strict();

export type GetDesignerWorkQueueQueryInput = z.infer<
  typeof getDesignerWorkQueueQuerySchema
>;

export const startDesignWorkParamsSchema = z.object({
  workspaceId: z.string().trim().min(1, "workspaceId is required"),
  researchItemId: z.string().trim().min(1, "researchItemId is required"),
});

export type StartDesignWorkParamsInput = z.infer<
  typeof startDesignWorkParamsSchema
>;
