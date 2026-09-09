import { ResearchStatus } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import {
  DashboardOverviewResult,
  DashboardPipelineCounts,
  ResolvedDashboardDateRange,
} from "./dashboard.type.js";
import { DashboardOverviewQueryInput } from "./dashboard.validation.js";

type ResolvedRangeWithFilter = {
  dateRange: ResolvedDashboardDateRange;
  filter: { gte: Date; lte: Date } | null;
};

// Resolves query parameters into a normalized UTC date range and Prisma filter.
export const resolveDashboardDateRange = (
  query: DashboardOverviewQueryInput,
  now = new Date()
): ResolvedRangeWithFilter => {
  // Explicit custom range takes precedence over preset
  if (query.dateFrom && query.dateTo) {
    const startDate = new Date(query.dateFrom);
    const endDate = new Date(query.dateTo);
    return {
      dateRange: {
        preset: "custom",
        dateFrom: startDate.toISOString(),
        dateTo: endDate.toISOString(),
      },
      filter: {
        gte: startDate,
        lte: endDate,
      },
    };
  }

  if (query.preset === "today") {
    const startOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const endOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
    return {
      dateRange: {
        preset: "today",
        dateFrom: startOfDay.toISOString(),
        dateTo: endOfDay.toISOString(),
      },
      filter: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };
  }

  if (query.preset === "week") {
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      dateRange: {
        preset: "week",
        dateFrom: startOfWeek.toISOString(),
        dateTo: now.toISOString(),
      },
      filter: {
        gte: startOfWeek,
        lte: now,
      },
    };
  }

  if (query.preset === "month") {
    const startOfMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      dateRange: {
        preset: "month",
        dateFrom: startOfMonth.toISOString(),
        dateTo: now.toISOString(),
      },
      filter: {
        gte: startOfMonth,
        lte: now,
      },
    };
  }

  // Default: "all" (no date filtering)
  return {
    dateRange: {
      preset: "all",
      dateFrom: null,
      dateTo: null,
    },
    filter: null,
  };
};

// Retrieves a current status snapshot of workspace research items within the selected cohort window.
export const getDashboardOverview = async (
  workspaceId: string,
  query: DashboardOverviewQueryInput
): Promise<DashboardOverviewResult> => {
  const { dateRange, filter } = resolveDashboardDateRange(query);

  const grouped = await prisma.researchItem.groupBy({
    by: ["status"],
    where: {
      workspaceId,
      ...(filter ? { createdAt: filter } : {}),
    },
    _count: {
      _all: true,
    },
  });

  const pipeline: DashboardPipelineCounts = {
    researched: 0,
    assigned: 0,
    designInProgress: 0,
    designReview: 0,
    correctionNeeded: 0,
    issueReported: 0,
    designApproved: 0,
    readyForListing: 0,
    listingInProgress: 0,
    listed: 0,
  };

  let totalResearch = 0;

  for (const row of grouped) {
    const count = row._count._all;
    totalResearch += count;

    switch (row.status) {
      case ResearchStatus.RESEARCHED:
        pipeline.researched = count;
        break;
      case ResearchStatus.ASSIGNED:
        pipeline.assigned = count;
        break;
      case ResearchStatus.DESIGN_IN_PROGRESS:
        pipeline.designInProgress = count;
        break;
      case ResearchStatus.DESIGN_REVIEW:
        pipeline.designReview = count;
        break;
      case ResearchStatus.CORRECTION_NEEDED:
        pipeline.correctionNeeded = count;
        break;
      case ResearchStatus.ISSUE_REPORTED:
        pipeline.issueReported = count;
        break;
      case ResearchStatus.DESIGN_APPROVED:
        pipeline.designApproved = count;
        break;
      case ResearchStatus.READY_FOR_LISTING:
        pipeline.readyForListing = count;
        break;
      case ResearchStatus.LISTING_IN_PROGRESS:
        pipeline.listingInProgress = count;
        break;
      case ResearchStatus.LISTED:
        pipeline.listed = count;
        break;
    }
  }

  return {
    dateRange,
    totalResearch,
    pipeline,
  };
};
