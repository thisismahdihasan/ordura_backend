import { Request, Response } from "express";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  dashboardOverviewParamsSchema,
  dashboardOverviewQuerySchema,
} from "./dashboard.validation.js";
import * as dashboardService from "./dashboard.service.js";

// Handles HTTP request for the admin dashboard pipeline overview.
export const getDashboardOverview = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = dashboardOverviewParamsSchema.parse(req.params);
  const query = dashboardOverviewQuerySchema.parse(req.query);

  const result = await dashboardService.getDashboardOverview(
    workspaceId,
    query
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Dashboard overview retrieved successfully",
    data: result,
  });
};
