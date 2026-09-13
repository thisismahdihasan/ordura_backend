import { Prisma } from "@prisma/client";

// Serializes workspace membership mutations with assignment selection so a role
// cannot be removed while new work is being assigned to that member.
export const acquireWorkspaceMemberMutationLock = async (
  tx: Prisma.TransactionClient,
  workspaceId: string
): Promise<void> => {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtext('workspace_member_mutation'),
      hashtext(${workspaceId})
    )
  `;
};
