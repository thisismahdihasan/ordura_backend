import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";
import { Server } from "http";

const PORT = env.PORT;

const server: Server = app.listen(PORT, () => {
  console.log(`Ordura backend server running on port ${PORT}`);
});

let isShuttingDown = false;

export const gracefulShutdown = async (
  signal: string,
  exitCode = 0
): Promise<void> => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

  const forceExitTimeout = setTimeout(() => {
    console.error("Forcefully terminating process due to shutdown timeout.");
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  server.close(async (serverCloseError) => {
    if (serverCloseError) {
      console.error("Error while closing HTTP server:", serverCloseError);
      exitCode = 1;
    } else {
      console.log("HTTP server closed successfully.");
    }

    try {
      await prisma.$disconnect();
      console.log("Prisma disconnected successfully.");
    } catch (disconnectError) {
      console.error("Error disconnecting Prisma:", disconnectError);
      exitCode = 1;
    }

    console.log("Graceful shutdown complete. Exiting process.");
    process.exit(exitCode);
  });
};

process.on("SIGINT", () => {
  gracefulShutdown("SIGINT", 0);
});

process.on("SIGTERM", () => {
  gracefulShutdown("SIGTERM", 0);
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("Unhandled Rejection detected:", reason);
  gracefulShutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error: Error) => {
  console.error("Uncaught Exception detected:", error);
  gracefulShutdown("uncaughtException", 1);
});
