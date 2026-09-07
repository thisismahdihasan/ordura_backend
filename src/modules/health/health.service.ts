import prisma from "../../lib/prisma.js";

// Confirms database connectivity by issuing a minimal raw ping query.
export const checkDatabaseHealth = async (): Promise<string> => {
  await prisma.$queryRaw`SELECT 1`;
  return "connected";
};
