import { NextFunction, Request, Response } from "express";
import { pipeline, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  createByteLimitTransform,
  fetchSafeImageStream,
} from "./research.referenceImage.js";
import {
  createResearchItem,
  getReferenceImageData,
  getResearchItemById,
  getResearchItems,
} from "./research.service.js";
import {
  createResearchItemSchema,
  getReferenceImageQuerySchema,
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

export const getReferenceImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { workspaceId, researchItemId } = getResearchItemParamsSchema.parse(
    req.params
  );
  const { download } = getReferenceImageQuerySchema.parse(req.query);

  const { referenceImageUrl } = await getReferenceImageData(
    workspaceId,
    researchItemId
  );

  const imageResult = await fetchSafeImageStream(referenceImageUrl);

  let ext = "jpg";
  if (imageResult.contentType.includes("png")) ext = "png";
  else if (imageResult.contentType.includes("webp")) ext = "webp";
  else if (imageResult.contentType.includes("gif")) ext = "gif";
  else if (imageResult.contentType.includes("jpeg")) ext = "jpg";

  const filename = `research-reference-${researchItemId}.${ext}`;
  const dispositionType = download ? "attachment" : "inline";

  res.setHeader("Content-Type", imageResult.contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader(
    "Content-Disposition",
    `${dispositionType}; filename="${filename}"`
  );

  if (imageResult.contentLength) {
    res.setHeader("Content-Length", imageResult.contentLength);
  }

  const nodeReadable = Readable.fromWeb(
    imageResult.body as unknown as NodeReadableStream
  );
  const byteLimitTransform = createByteLimitTransform();

  pipeline(nodeReadable, byteLimitTransform, res, (err) => {
    if (err) {
      if (!res.headersSent) {
        next(err);
      } else {
        res.destroy(err);
      }
    }
  });
};

