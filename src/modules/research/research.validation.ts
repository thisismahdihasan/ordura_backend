import { z } from "zod";
import { extractEtsyListing } from "./research.helper.js";

export const createResearchItemSchema = z
  .object({
    etsyUrl: z
      .string({ message: "etsyUrl is required" })
      .trim()
      .min(1, "etsyUrl is required")
      .superRefine((val, ctx) => {
        try {
          extractEtsyListing(val);
        } catch (err) {
          if (err instanceof Error) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: err.message,
            });
          } else {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Invalid Etsy listing URL",
            });
          }
        }
      }),
  })
  .strict();

export type CreateResearchItemInput = z.infer<typeof createResearchItemSchema>;
