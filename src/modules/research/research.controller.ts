import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  createResearchItem,
  getResearchItemById,
  getResearchItems,
} from "./research.service.js";
import {
  createResearchItemSchema,
  getResearchItemParamsSchema,
  getResearchItemsQuerySchema,
} from "./research.validation.js";

export const create = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedInput = createResearchItemSchema.parse(req.body);

  const researchItem = await createResearchItem(
    workspaceId,
    authReq.user.id,
    validatedInput
  );

  ApiResponse.success(res, {
    statusCode: 201,
    message: "Research item created successfully",
    data: {
      researchItem,
    },
  });
};

export const list = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedQuery = getResearchItemsQuerySchema.parse(req.query);

  const result = await getResearchItems(workspaceId, validatedQuery);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Research items retrieved successfully",
    data: result,
  });
};

export const getById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId, researchItemId } = getResearchItemParamsSchema.parse(
    req.params
  );

  const researchItem = await getResearchItemById(workspaceId, researchItemId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Research item retrieved successfully",
    data: {
      researchItem,
    },
  });
};
