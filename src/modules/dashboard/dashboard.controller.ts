import { Request, Response } from "express";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  dashboardOverviewParamsSchema,
  dashboardOverviewQuerySchema,
  userActivityParamsSchema,
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

// Handles HTTP request for the admin dashboard researcher performance.
export const getResearcherPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = dashboardOverviewParamsSchema.parse(req.params);
  const query = dashboardOverviewQuerySchema.parse(req.query);

  const result = await dashboardService.getResearcherPerformance(
    workspaceId,
    query
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Researcher performance retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for the admin dashboard designer performance.
export const getDesignerPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = dashboardOverviewParamsSchema.parse(req.params);
  const query = dashboardOverviewQuerySchema.parse(req.query);

  const result = await dashboardService.getDesignerPerformance(
    workspaceId,
    query
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Designer performance retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for the admin dashboard lister performance.
export const getListerPerformance = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = dashboardOverviewParamsSchema.parse(req.params);
  const query = dashboardOverviewQuerySchema.parse(req.query);

  const result = await dashboardService.getListerPerformance(
    workspaceId,
    query
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Lister performance retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for inspecting a workspace member's activity and throughput metrics.
export const getUserActivity = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId, userId } = userActivityParamsSchema.parse(req.params);
  const query = dashboardOverviewQuerySchema.parse(req.query);

  const result = await dashboardService.getUserActivity(
    workspaceId,
    userId,
    query
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "User activity retrieved successfully",
    data: result,
  });
};
