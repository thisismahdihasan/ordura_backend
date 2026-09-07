import { Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import { createResearchItem } from "./research.service.js";
import { createResearchItemSchema } from "./research.validation.js";

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
