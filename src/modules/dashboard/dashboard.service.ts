import { ResearchStatus, WorkspaceRole } from "@prisma/client";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  DashboardOverviewResult,
  DashboardPipelineCounts,
  DesignerPerformanceResult,
  DesignerPerformanceRow,
  ListerPerformanceResult,
  ListerPerformanceRow,
  ResearcherPerformanceResult,
  ResearcherPerformanceRow,
  ResolvedDashboardDateRange,
  UserActivityRecentItem,
  UserActivityRecentItemRole,
  UserActivityResult,
  UserActivitySummaryDesign,
  UserActivitySummaryListing,
  UserActivitySummaryResearch,
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

// Retrieves researcher productivity metrics within the selected cohort window.
export const getResearcherPerformance = async (
  workspaceId: string,
  query: DashboardOverviewQueryInput
): Promise<ResearcherPerformanceResult> => {
  const { dateRange, filter } = resolveDashboardDateRange(query);

  // 1. Fetch current members with RESEARCHER role and grouped research item counts in parallel
  const [currentResearchers, groupedCounts] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        roles: {
          has: WorkspaceRole.RESEARCHER,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.researchItem.groupBy({
      by: ["createdById"],
      where: {
        workspaceId,
        ...(filter ? { createdAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const researchersMap = new Map<string, ResearcherPerformanceRow>();

  // 2. Initialize map with all current RESEARCHER members (even if researchCount = 0)
  for (const member of currentResearchers) {
    researchersMap.set(member.userId, {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      researchCount: 0,
    });
  }

  // 3. Find any creator who has research items in this range but is not currently a RESEARCHER member
  const missingCreatorIds: string[] = [];
  for (const group of groupedCounts) {
    if (!researchersMap.has(group.createdById)) {
      missingCreatorIds.push(group.createdById);
    }
  }

  // 4. Batch-fetch identity for any historical creators
  if (missingCreatorIds.length > 0) {
    const historicalUsers = await prisma.user.findMany({
      where: {
        id: { in: missingCreatorIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    for (const u of historicalUsers) {
      researchersMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        researchCount: 0,
      });
    }
  }

  // 5. Populate researchCount from the grouped query results
  for (const group of groupedCounts) {
    const row = researchersMap.get(group.createdById);
    if (row) {
      row.researchCount = group._count._all;
    }
  }

  // 6. Deterministic sort: researchCount DESC -> name ASC -> userId ASC
  const researchers = Array.from(researchersMap.values()).sort((a, b) => {
    if (b.researchCount !== a.researchCount) {
      return b.researchCount - a.researchCount;
    }
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return a.userId.localeCompare(b.userId);
  });

  return {
    dateRange,
    researchers,
  };
};

// Retrieves designer throughput and performance metrics within the selected cohort window.
export const getDesignerPerformance = async (
  workspaceId: string,
  query: DashboardOverviewQueryInput
): Promise<DesignerPerformanceResult> => {
  const { dateRange, filter } = resolveDashboardDateRange(query);

  // 1. Fetch current members with DESIGNER role and 6 aggregate groups in parallel
  const [
    currentDesigners,
    assignedGroups,
    currentInProgressGroups,
    submittedGroups,
    approvedGroups,
    correctionsGroups,
    completedGroups,
  ] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        roles: {
          has: WorkspaceRole.DESIGNER,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.designAssignment.groupBy({
      by: ["designerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        ...(filter ? { assignedAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
    prisma.designAssignment.groupBy({
      by: ["designerId"],
      where: {
        isCurrent: true,
        researchItem: {
          workspaceId,
          status: ResearchStatus.DESIGN_IN_PROGRESS,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.reviewSubmission.groupBy({
      by: ["designerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        ...(filter ? { submittedAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
    prisma.reviewSubmission.groupBy({
      by: ["designerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        approvedAt: filter ? filter : { not: null },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.reviewSubmission.groupBy({
      by: ["designerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        roundNumber: {
          gt: 1,
        },
        ...(filter ? { submittedAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
    prisma.designAssignment.groupBy({
      by: ["designerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        completedAt: filter ? filter : { not: null },
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const designersMap = new Map<string, DesignerPerformanceRow>();

  // 2. Initialize map with all current DESIGNER members (even if all metrics = 0)
  for (const member of currentDesigners) {
    designersMap.set(member.userId, {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      assignedCount: 0,
      currentInProgress: 0,
      submittedCount: 0,
      approvedCount: 0,
      correctionsCount: 0,
      completedCount: 0,
    });
  }

  // 3. Identify any historical designer who contributed in this window or is in currentInProgress
  const allGroups = [
    assignedGroups,
    currentInProgressGroups,
    submittedGroups,
    approvedGroups,
    correctionsGroups,
    completedGroups,
  ];

  const missingDesignerIds = new Set<string>();
  for (const groups of allGroups) {
    for (const g of groups) {
      if (!designersMap.has(g.designerId)) {
        missingDesignerIds.add(g.designerId);
      }
    }
  }

  // 4. Batch-fetch identity for any historical designers
  if (missingDesignerIds.size > 0) {
    const historicalUsers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(missingDesignerIds) },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    for (const u of historicalUsers) {
      designersMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        assignedCount: 0,
        currentInProgress: 0,
        submittedCount: 0,
        approvedCount: 0,
        correctionsCount: 0,
        completedCount: 0,
      });
    }
  }

  // 5. Populate metric counts
  for (const g of assignedGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.assignedCount = g._count._all;
  }
  for (const g of currentInProgressGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.currentInProgress = g._count._all;
  }
  for (const g of submittedGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.submittedCount = g._count._all;
  }
  for (const g of approvedGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.approvedCount = g._count._all;
  }
  for (const g of correctionsGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.correctionsCount = g._count._all;
  }
  for (const g of completedGroups) {
    const row = designersMap.get(g.designerId);
    if (row) row.completedCount = g._count._all;
  }

  // 6. Deterministic sort: completedCount DESC -> approvedCount DESC -> name ASC -> userId ASC
  const designers = Array.from(designersMap.values()).sort((a, b) => {
    if (b.completedCount !== a.completedCount) {
      return b.completedCount - a.completedCount;
    }
    if (b.approvedCount !== a.approvedCount) {
      return b.approvedCount - a.approvedCount;
    }
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return a.userId.localeCompare(b.userId);
  });

  return {
    dateRange,
    designers,
  };
};

// Retrieves lister workload and publishing throughput metrics within the selected cohort window.
export const getListerPerformance = async (
  workspaceId: string,
  query: DashboardOverviewQueryInput
): Promise<ListerPerformanceResult> => {
  const { dateRange, filter } = resolveDashboardDateRange(query);

  // 1. Fetch current members with LISTER role and 3 aggregate groups in parallel
  const [
    currentListers,
    assignedGroups,
    currentInProgressGroups,
    listedGroups,
  ] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        roles: {
          has: WorkspaceRole.LISTER,
        },
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.listingAssignment.groupBy({
      by: ["listerId"],
      where: {
        researchItem: {
          workspaceId,
        },
        ...(filter ? { assignedAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
    prisma.listingAssignment.groupBy({
      by: ["listerId"],
      where: {
        isCurrent: true,
        researchItem: {
          workspaceId,
          status: ResearchStatus.LISTING_IN_PROGRESS,
        },
      },
      _count: {
        _all: true,
      },
    }),
    prisma.listingResult.groupBy({
      by: ["listedById"],
      where: {
        researchItem: {
          workspaceId,
        },
        ...(filter ? { listedAt: filter } : {}),
      },
      _count: {
        _all: true,
      },
    }),
  ]);

  const listersMap = new Map<string, ListerPerformanceRow>();

  // 2. Initialize map with all current LISTER members (even if all metrics = 0)
  for (const member of currentListers) {
    listersMap.set(member.userId, {
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      assignedCount: 0,
      currentInProgress: 0,
      listedCount: 0,
    });
  }

  // 3. Identify any historical lister who contributed in this window or is in currentInProgress
  const missingListerIds = new Set<string>();
  for (const g of assignedGroups) {
    if (!listersMap.has(g.listerId)) {
      missingListerIds.add(g.listerId);
    }
  }
  for (const g of currentInProgressGroups) {
    if (!listersMap.has(g.listerId)) {
      missingListerIds.add(g.listerId);
    }
  }
  for (const g of listedGroups) {
    if (!listersMap.has(g.listedById)) {
      missingListerIds.add(g.listedById);
    }
  }

  // 4. Batch-fetch identity for any historical listers
  if (missingListerIds.size > 0) {
    const historicalUsers = await prisma.user.findMany({
      where: {
        id: { in: Array.from(missingListerIds) },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    for (const u of historicalUsers) {
      listersMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        assignedCount: 0,
        currentInProgress: 0,
        listedCount: 0,
      });
    }
  }

  // 5. Populate metric counts
  for (const g of assignedGroups) {
    const row = listersMap.get(g.listerId);
    if (row) row.assignedCount = g._count._all;
  }
  for (const g of currentInProgressGroups) {
    const row = listersMap.get(g.listerId);
    if (row) row.currentInProgress = g._count._all;
  }
  for (const g of listedGroups) {
    const row = listersMap.get(g.listedById);
    if (row) row.listedCount = g._count._all;
  }

  // 6. Deterministic sort: listedCount DESC -> assignedCount DESC -> name ASC -> userId ASC
  const listers = Array.from(listersMap.values()).sort((a, b) => {
    if (b.listedCount !== a.listedCount) {
      return b.listedCount - a.listedCount;
    }
    if (b.assignedCount !== a.assignedCount) {
      return b.assignedCount - a.assignedCount;
    }
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    const nameDiff = nameA.localeCompare(nameB);
    if (nameDiff !== 0) {
      return nameDiff;
    }
    return a.userId.localeCompare(b.userId);
  });

  return {
    dateRange,
    listers,
  };
};

// Retrieves activity and throughput metrics for a specific workspace member.
export const getUserActivity = async (
  workspaceId: string,
  userId: string,
  query: DashboardOverviewQueryInput
): Promise<UserActivityResult> => {
  // 1. Verify target user is a member of the target workspace
  const member = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      id: true,
      roles: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!member) {
    throw new ApiError(404, "User not found in this workspace");
  }

  const { dateRange, filter } = resolveDashboardDateRange(query);

  // 2. Fetch summary aggregates and recent items in parallel
  const researchPromise = prisma.researchItem.count({
    where: {
      workspaceId,
      createdById: userId,
      ...(filter ? { createdAt: filter } : {}),
    },
  });

  const designPromise = Promise.all([
        prisma.designAssignment.count({
          where: {
            designerId: userId,
            researchItem: { workspaceId },
            ...(filter ? { assignedAt: filter } : {}),
          },
        }),
        prisma.designAssignment.count({
          where: {
            designerId: userId,
            isCurrent: true,
            researchItem: {
              workspaceId,
              status: ResearchStatus.DESIGN_IN_PROGRESS,
            },
          },
        }),
        prisma.reviewSubmission.count({
          where: {
            designerId: userId,
            researchItem: { workspaceId },
            ...(filter ? { submittedAt: filter } : {}),
          },
        }),
        prisma.reviewSubmission.count({
          where: {
            designerId: userId,
            researchItem: { workspaceId },
            approvedAt: filter ? filter : { not: null },
          },
        }),
        prisma.reviewSubmission.count({
          where: {
            designerId: userId,
            researchItem: { workspaceId },
            roundNumber: { gt: 1 },
            ...(filter ? { submittedAt: filter } : {}),
          },
        }),
        prisma.designAssignment.count({
          where: {
            designerId: userId,
            researchItem: { workspaceId },
            completedAt: filter ? filter : { not: null },
          },
        }),
      ]);

  const listingPromise = Promise.all([
        prisma.listingAssignment.count({
          where: {
            listerId: userId,
            researchItem: { workspaceId },
            ...(filter ? { assignedAt: filter } : {}),
          },
        }),
        prisma.listingAssignment.count({
          where: {
            listerId: userId,
            isCurrent: true,
            researchItem: {
              workspaceId,
              status: ResearchStatus.LISTING_IN_PROGRESS,
            },
          },
        }),
        prisma.listingResult.count({
          where: {
            listedById: userId,
            researchItem: { workspaceId },
            ...(filter ? { listedAt: filter } : {}),
          },
        }),
      ]);

  const recentItemsPromise = prisma.researchItem.findMany({
    where: {
      workspaceId,
      OR: [
        { createdById: userId },
        {
          designAssignments: {
            some: {
              designerId: userId,
              isCurrent: true,
            },
          },
        },
        {
          listingAssignments: {
            some: {
              listerId: userId,
              isCurrent: true,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      createdById: true,
      designAssignments: {
        where: {
          designerId: userId,
          isCurrent: true,
        },
        select: {
          id: true,
        },
      },
      listingAssignments: {
        where: {
          listerId: userId,
          isCurrent: true,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 15,
  });

  const [researchCount, designMetrics, listingMetrics, rawRecentItems] =
    await Promise.all([
      researchPromise,
      designPromise,
      listingPromise,
      recentItemsPromise,
    ]);

  const researchSummary: UserActivitySummaryResearch | null =
    researchCount > 0
      ? {
          totalCreated: researchCount,
        }
      : null;

  const designSummary: UserActivitySummaryDesign | null =
    designMetrics.some((metric) => metric > 0)
      ? {
          assignedCount: designMetrics[0],
          currentInProgress: designMetrics[1],
          submittedCount: designMetrics[2],
          approvedCount: designMetrics[3],
          correctionsCount: designMetrics[4],
          completedCount: designMetrics[5],
        }
      : null;

  const listingSummary: UserActivitySummaryListing | null =
    listingMetrics.some((metric) => metric > 0)
      ? {
          assignedCount: listingMetrics[0],
          currentInProgress: listingMetrics[1],
          listedCount: listingMetrics[2],
        }
      : null;

  const recentItems: UserActivityRecentItem[] = rawRecentItems.map((item) => {
    let activityRole: UserActivityRecentItemRole;
    if (item.listingAssignments.length > 0) {
      activityRole = "LISTER";
    } else if (item.designAssignments.length > 0) {
      activityRole = "DESIGNER";
    } else {
      activityRole = "RESEARCHER";
    }

    return {
      id: item.id,
      title: item.title,
      status: item.status,
      activityRole,
      updatedAt: item.updatedAt.toISOString(),
    };
  });

  return {
    dateRange,
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      roles: member.roles,
      joinedAt: member.createdAt.toISOString(),
    },
    summary: {
      research: researchSummary,
      design: designSummary,
      listing: listingSummary,
    },
    recentItems,
  };
};
