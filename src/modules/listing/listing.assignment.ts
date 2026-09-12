import { Prisma, ResearchStatus, WorkspaceRole } from "@prisma/client";
import {
  AssignListerResult,
  ListerWorkload,
  NOTIFICATION_TYPE_LISTING_ASSIGNED,
} from "./listing.type.js";

export const ACTIVE_LISTING_WORKLOAD_STATUSES: ResearchStatus[] = [
  ResearchStatus.READY_FOR_LISTING,
  ResearchStatus.LISTING_IN_PROGRESS,
];

// Acquires a dedicated PostgreSQL transaction-level advisory lock strictly scoped to the workspace's listing assignments.
export const acquireWorkspaceListerLock = async (
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<void> => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('lister_assignment'),
      hashtext(${workspaceId})
    )
  `;
};

// Identifies the workspace lister with lowest active workload, using join date and userId as deterministic tie-breakers.
export const findLeastWorkloadLister = async (
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<string | null> => {
  const eligibleMembers = await tx.workspaceMember.findMany({
    where: {
      workspaceId,
      roles: { has: WorkspaceRole.LISTER },
    },
    select: {
      userId: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
  });

  if (eligibleMembers.length === 0) {
    return null;
  }

  if (eligibleMembers.length === 1) {
    return eligibleMembers[0].userId;
  }

  const workloadCounts: ListerWorkload[] = await Promise.all(
    eligibleMembers.map(async (member) => {
      const count = await tx.listingAssignment.count({
        where: {
          listerId: member.userId,
          isCurrent: true,
          researchItem: {
            workspaceId,
            status: { in: ACTIVE_LISTING_WORKLOAD_STATUSES },
          },
        },
      });

      return {
        userId: member.userId,
        createdAt: member.createdAt,
        activeWorkload: count,
      };
    })
  );

  workloadCounts.sort((a, b) => {
    if (a.activeWorkload !== b.activeWorkload) {
      return a.activeWorkload - b.activeWorkload;
    }
    if (a.createdAt.getTime() !== b.createdAt.getTime()) {
      return a.createdAt.getTime() - b.createdAt.getTime();
    }
    return a.userId.localeCompare(b.userId);
  });

  return workloadCounts[0].userId;
};

// Atomically assigns an unassigned READY_FOR_LISTING research item to the least-workload lister under a workspace advisory lock.
// Strictly NEVER steals, modifies, or deactivates any existing current assignment.
export const assignLeastWorkloadLister = async (
  tx: Prisma.TransactionClient,
  workspaceId: string,
  researchItemId: string
): Promise<AssignListerResult> => {
  // 1. Acquire workspace-scoped advisory transaction lock
  await acquireWorkspaceListerLock(tx, workspaceId);

  // 2. Scoped item verification: must belong to workspace and be READY_FOR_LISTING
  const item = await tx.researchItem.findFirst({
    where: {
      id: researchItemId,
      workspaceId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!item || item.status !== ResearchStatus.READY_FOR_LISTING) {
    return null;
  }

  // 3. Existing current assignment check: strictly never reassign or overwrite current work
  const existingAssignment = await tx.listingAssignment.findFirst({
    where: {
      researchItemId,
      isCurrent: true,
    },
    select: {
      id: true,
      listerId: true,
      assignedAt: true,
    },
  });

  if (existingAssignment) {
    return {
      assignmentId: existingAssignment.id,
      listerId: existingAssignment.listerId,
      assignedAt: existingAssignment.assignedAt,
      isNew: false,
    };
  }

  // 4. Find least-workload eligible lister
  const chosenListerId = await findLeastWorkloadLister(tx, workspaceId);

  if (!chosenListerId) {
    // Graceful no-lister handling: item stays unassigned in READY_FOR_LISTING
    return null;
  }

  // 5. Create new current ListingAssignment
  const newAssignment = await tx.listingAssignment.create({
    data: {
      researchItemId,
      listerId: chosenListerId,
      isCurrent: true,
    },
    select: {
      id: true,
      listerId: true,
      assignedAt: true,
    },
  });

  // 6. Create exactly one in-app notification for the newly assigned lister
  await tx.notification.create({
    data: {
      workspaceId,
      userId: chosenListerId,
      type: NOTIFICATION_TYPE_LISTING_ASSIGNED,
      title: "New Design Ready for Listing",
      message: "You have been assigned to list a new design.",
      researchItemId,
    },
  });

  return {
    assignmentId: newAssignment.id,
    listerId: newAssignment.listerId,
    assignedAt: newAssignment.assignedAt,
    isNew: true,
  };
};
