import { z } from "zod";
import { ResearchStatus } from "@prisma/client";

export const LISTER_QUEUE_ACTIVE_STATUSES = [
  ResearchStatus.READY_FOR_LISTING,
  ResearchStatus.LISTING_IN_PROGRESS,
] as const;

export type ListerQueueActiveStatus =
  (typeof LISTER_QUEUE_ACTIVE_STATUSES)[number];

export const getListerWorkQueueQuerySchema = z
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
        (val): val is ListerQueueActiveStatus =>
          (LISTER_QUEUE_ACTIVE_STATUSES as readonly ResearchStatus[]).includes(
            val
          ),
        {
          message:
            "Invalid status filter. Allowed values: READY_FOR_LISTING, LISTING_IN_PROGRESS",
        }
      )
      .optional(),
    search: z
      .string()
      .trim()
      .max(100, "search cannot exceed 100 characters")
      .transform((val) => (val.length > 0 ? val : undefined))
      .optional(),
  })
  .strict();

export type GetListerWorkQueueQueryInput = z.infer<
  typeof getListerWorkQueueQuerySchema
>;

export const backfillListingAssignmentsParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
  })
  .strict();

export type BackfillListingAssignmentsParamsInput = z.infer<
  typeof backfillListingAssignmentsParamsSchema
>;

export const startListingParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
    researchItemId: z.string().trim().min(1, "researchItemId is required"),
  })
  .strict();

export type StartListingParamsInput = z.infer<
  typeof startListingParamsSchema
>;

export const startListingBodySchema = z
  .object({})
  .strict()
  .optional();

export type StartListingBodyInput = z.infer<
  typeof startListingBodySchema
>;

export const downloadFinalAssetParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
    assetId: z.string().trim().min(1, "assetId is required"),
  })
  .strict();

export type DownloadFinalAssetParamsInput = z.infer<
  typeof downloadFinalAssetParamsSchema
>;
