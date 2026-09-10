import { jsonError, jsonSuccess } from "../components.js";
import { OpenApiPathMap } from "../docs.type.js";

export const healthPaths: OpenApiPathMap = {
  "/api/v1/health": {
    get: {
      tags: ["Health"],
      summary: "Check API and database health",
      responses: {
        "200": jsonSuccess("Backend and database are healthy.", {
          type: "object",
          required: ["database"],
          properties: { database: { type: "string", enum: ["connected"] } },
        }),
        "500": jsonError("Database health check failed."),
      },
    },
  },
};
