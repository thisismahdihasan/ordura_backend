import { NextFunction, Request, Response } from "express";
import { pipeline, Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import {
  createByteLimitTransform,
  fetchSafeImageStream,
} from "./research.referenceImage.js";
import * as researchService from "./research.service.js";
import {
  createResearchItemSchema,
  getReferenceImageQuerySchema,
  getResearchItemParamsSchema,
  getResearchItemsQuerySchema,
  reassignDesignerBodySchema,
} from "./research.validation.js";

// Creates a research item from an Etsy listing URL and automatically assigns an eligible designer.
export const createResearchItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedInput = createResearchItemSchema.parse(req.body);

  const researchItem = await researchService.createResearchItem(
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

// Retrieves a paginated list of research items in the workspace with optional filters.
export const getResearchItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedQuery = getResearchItemsQuerySchema.parse(req.query);

  const result = await researchService.getResearchItems(workspaceId, validatedQuery);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Research items retrieved successfully",
    data: result,
  });
};

// Fetches a single research item by ID within the authenticated workspace.
export const getResearchItemById = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId, researchItemId } = getResearchItemParamsSchema.parse(
    req.params
  );

  const researchItem = await researchService.getResearchItemById(workspaceId, researchItemId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Research item retrieved successfully",
    data: {
      researchItem,
    },
  });
};

// Proxies the reference image stream with SSRF protection, size caps, and preview/download disposition.
export const getResearchReferenceImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { workspaceId, researchItemId } = getResearchItemParamsSchema.parse(
    req.params
  );
  const { download } = getReferenceImageQuerySchema.parse(req.query);

  const { referenceImageUrl } = await researchService.getReferenceImageData(
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

// Manually reassigns an existing research item to a different workspace designer.
export const reassignResearchDesigner = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId, researchItemId } = getResearchItemParamsSchema.parse(
    req.params
  );
  const validatedBody = reassignDesignerBodySchema.parse(req.body);

  const result = await researchService.reassignResearchDesigner(
    workspaceId,
    researchItemId,
    validatedBody.designerId
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Designer reassigned successfully",
    data: result,
  });
};


