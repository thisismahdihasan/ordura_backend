import prisma from "../../lib/prisma.js";

export const checkDatabaseHealth = async (): Promise<string> => {
  await prisma.$queryRaw`SELECT 1`;
  return "connected";
};
