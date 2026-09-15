import { Prisma, WorkspaceRole } from "@prisma/client";

export type AssignmentEligibleRole =
  | typeof WorkspaceRole.DESIGNER
  | typeof WorkspaceRole.LISTER;

// Generates a Prisma where filter for automatic assignment eligibility.
// A member is eligible iff:
// 1. Member possesses the specific role
// 2. Assignment for that role is explicitly enabled
// 3. Temporary pause is either null or has already passed (<= now)
export const getRoleAssignmentEligibilityFilter = (
  role: AssignmentEligibleRole,
  now: Date = new Date()
): Prisma.WorkspaceMemberWhereInput => {
  if (role === WorkspaceRole.DESIGNER) {
    return {
      roles: { has: WorkspaceRole.DESIGNER },
      designerAssignmentEnabled: true,
      OR: [
        { designerAssignmentPausedUntil: null },
        { designerAssignmentPausedUntil: { lte: now } },
      ],
    };
  }

  return {
    roles: { has: WorkspaceRole.LISTER },
    listerAssignmentEnabled: true,
    OR: [
      { listerAssignmentPausedUntil: null },
      { listerAssignmentPausedUntil: { lte: now } },
    ],
  };
};

// In-memory evaluation helper for loaded member records
export const isMemberAssignmentEligible = (
  member: {
    roles: WorkspaceRole[];
    designerAssignmentEnabled: boolean;
    designerAssignmentPausedUntil: Date | null;
    listerAssignmentEnabled: boolean;
    listerAssignmentPausedUntil: Date | null;
  },
  role: AssignmentEligibleRole,
  now: Date = new Date()
): boolean => {
  if (!member.roles.includes(role)) {
    return false;
  }

  if (role === WorkspaceRole.DESIGNER) {
    return (
      member.designerAssignmentEnabled &&
      (member.designerAssignmentPausedUntil === null ||
        member.designerAssignmentPausedUntil <= now)
    );
  }

  return (
    member.listerAssignmentEnabled &&
    (member.listerAssignmentPausedUntil === null ||
      member.listerAssignmentPausedUntil <= now)
  );
};
