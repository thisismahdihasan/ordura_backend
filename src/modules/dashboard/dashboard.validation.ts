import { z } from "zod";

export const dashboardOverviewParamsSchema = z
  .object({
    workspaceId: z.string().trim().min(1, "workspaceId is required"),
  })
  .strict();

export type DashboardOverviewParamsInput = z.infer<
  typeof dashboardOverviewParamsSchema
>;

const ISO_DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const isValidIsoDateString = (val: string): boolean => {
  if (!ISO_DATETIME_REGEX.test(val)) {
    return false;
  }
  const parsed = new Date(val);
  return !Number.isNaN(parsed.getTime());
};

export const DASHBOARD_DATE_PRESETS = [
  "all",
  "today",
  "week",
  "month",
  "custom",
] as const;

export const dashboardOverviewQuerySchema = z
  .object({
    preset: z
      .enum(DASHBOARD_DATE_PRESETS, {
        message: "preset must be one of: all, today, week, month, custom",
      })
      .optional()
      .default("all"),
    dateFrom: z.string().trim().optional(),
    dateTo: z.string().trim().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasFrom = data.dateFrom !== undefined && data.dateFrom.length > 0;
    const hasTo = data.dateTo !== undefined && data.dateTo.length > 0;

    if (hasFrom && !hasTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateTo"],
        message: "dateTo is required when dateFrom is provided",
      });
      return;
    }

    if (!hasFrom && hasTo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateFrom"],
        message: "dateFrom is required when dateTo is provided",
      });
      return;
    }

    if (data.preset === "custom" && (!hasFrom || !hasTo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["preset"],
        message: "dateFrom and dateTo are both required when preset is 'custom'",
      });
      return;
    }

    if (hasFrom && hasTo) {
      if (!isValidIsoDateString(data.dateFrom!)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateFrom"],
          message: "Invalid dateFrom format. Expected ISO datetime string.",
        });
        return;
      }

      if (!isValidIsoDateString(data.dateTo!)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateTo"],
          message: "Invalid dateTo format. Expected ISO datetime string.",
        });
        return;
      }

      const fromTime = new Date(data.dateFrom!).getTime();
      const toTime = new Date(data.dateTo!).getTime();

      if (fromTime > toTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateFrom"],
          message: "dateFrom cannot be after dateTo",
        });
      }
    }
  });

export type DashboardOverviewQueryInput = z.infer<
  typeof dashboardOverviewQuerySchema
>;

export const dashboardDateRangeQuerySchema = dashboardOverviewQuerySchema;
export type DashboardDateRangeQueryInput = DashboardOverviewQueryInput;
