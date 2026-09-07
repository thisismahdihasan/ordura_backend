import { Prisma, ResearchStatus, WorkspaceRole } from "@prisma/client";

export const ACTIVE_DESIGN_STATUSES: ResearchStatus[] = [
  ResearchStatus.ASSIGNED,
  ResearchStatus.DESIGN_IN_PROGRESS,
  ResearchStatus.DESIGN_REVIEW,
  ResearchStatus.CORRECTION_NEEDED,
];

export type DesignerWorkload = {
  userId: string;
  createdAt: Date;
  activeWorkload: number;
};

// Identifies the workspace designer with the lowest active workload, using join date and ID as deterministic tie-breakers.
export const findLeastWorkloadDesigner = async (
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<string | null> => {
  const eligibleMembers = await tx.workspaceMember.findMany({
    where: {
      workspaceId,
      roles: { has: WorkspaceRole.DESIGNER },
    },
    select: {
      userId: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "asc" },
      { userId: "asc" },
    ],
  });

  if (eligibleMembers.length === 0) {
    return null;
  }

  if (eligibleMembers.length === 1) {
    return eligibleMembers[0].userId;
  }

  const workloadCounts: DesignerWorkload[] = await Promise.all(
    eligibleMembers.map(async (member) => {
      const count = await tx.designAssignment.count({
        where: {
          designerId: member.userId,
          isCurrent: true,
          researchItem: {
            workspaceId,
            status: { in: ACTIVE_DESIGN_STATUSES },
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
