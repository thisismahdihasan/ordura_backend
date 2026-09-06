import { Request, Response } from "express";
import { checkDatabaseHealth } from "./health.service.js";
import { ApiResponse } from "../../shared/ApiResponse.js";

export const getHealth = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const databaseStatus = await checkDatabaseHealth();

  ApiResponse.success(res, {
    message: "Ordura backend is healthy",
    data: {
      database: databaseStatus,
    },
  });
};
