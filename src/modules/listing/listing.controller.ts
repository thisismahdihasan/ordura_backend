import { NextFunction, Request, Response } from "express";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as listingService from "./listing.service.js";
import {
  backfillListingAssignmentsParamsSchema,
  getListerWorkQueueQuerySchema,
  startListingBodySchema,
  startListingParamsSchema,
  downloadFinalAssetParamsSchema,
  completeListingBodySchema,
  completeListingParamsSchema,
} from "./listing.validation.js";

const safeDownloadContentType = (mimeType: string): string => {
  const normalized = mimeType.trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
    ? normalized
    : "application/octet-stream";
};

const safeDownloadFileName = (fileName: string): string => {
  const cleaned = fileName
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim();

  return cleaned || "download";
};

const contentDispositionForFileName = (fileName: string): string => {
  const safeFileName = safeDownloadFileName(fileName);
  const asciiFallback = safeFileName
    .replace(/[^A-Za-z0-9._ -]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "download";
  const encodedFileName = encodeURIComponent(safeFileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`;
};

// Handles HTTP request for fetching the authenticated lister's active work queue.
export const getListerWorkQueue = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const rawWorkspaceId = req.params.workspaceId;
  const workspaceId = Array.isArray(rawWorkspaceId)
    ? rawWorkspaceId[0]
    : rawWorkspaceId;

  const validatedQuery = getListerWorkQueueQuerySchema.parse(req.query);

  const result = await listingService.getListerWorkQueue(
    workspaceId,
    authReq.user.id,
    validatedQuery
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Lister work queue retrieved successfully",
    data: result,
  });
};

// Handles HTTP request for manually backfilling unassigned READY_FOR_LISTING items.
export const backfillListingAssignments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = backfillListingAssignmentsParamsSchema.parse(
    req.params
  );

  const result = await listingService.backfillUnassignedListings(workspaceId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Unassigned listings backfilled successfully",
    data: result,
  });
};

// Handles HTTP request for starting listing work on an assigned research item.
export const startListing = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = startListingParamsSchema.parse(
    req.params
  );
  startListingBodySchema.parse(req.body);

  const result = await listingService.startListingWork(
    workspaceId,
    researchItemId,
    authReq.user.id
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Listing work started successfully",
    data: result,
  });
};

// Handles completion of listing work by the current assigned lister.
export const completeListing = async (
  req: Request,
  res: Response
): Promise<void> => {
  const authReq = req as WorkspaceAuthorizedRequest;
  const { workspaceId, researchItemId } = completeListingParamsSchema.parse(
    req.params
  );
  const input = completeListingBodySchema.parse(req.body);

  const result = await listingService.completeListingWork(
    workspaceId,
    researchItemId,
    authReq.user.id,
    input
  );

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Listing completed successfully",
    data: result,
  });
};

type FinalAssetDownloadResolver =
  typeof listingService.getAuthorizedFinalAssetDownload;

// Builds the HTTP stream handler with an explicit resolver seam for deterministic provider-free tests.
export const createDownloadFinalAssetHandler = (
  resolveDownload: FinalAssetDownloadResolver =
    listingService.getAuthorizedFinalAssetDownload
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const authReq = req as WorkspaceAuthorizedRequest;
    const { workspaceId, assetId } = downloadFinalAssetParamsSchema.parse(
      req.params
    );
    const download = await resolveDownload(
      workspaceId,
      assetId,
      authReq.user.id,
      authReq.workspaceMembership.roles
    );

    const stopUpstream = (): void => {
      if (!download.stream.destroyed) {
        download.stream.destroy();
      }
    };

    const onClientAbort = (): void => {
      stopUpstream();
    };

    const onResponseClose = (): void => {
      if (!res.writableEnded) {
        stopUpstream();
      }
    };

    const onStreamError = (error: Error): void => {
      req.off("aborted", onClientAbort);
      res.off("close", onResponseClose);

      if (!res.headersSent) {
        next(error);
        return;
      }

      res.destroy();
    };

    req.once("aborted", onClientAbort);
    res.once("close", onResponseClose);
    download.stream.once("error", onStreamError);

    res.status(200);
    res.setHeader("Content-Type", safeDownloadContentType(download.mimeType));
    if (download.fileSize >= 0n) {
      res.setHeader("Content-Length", download.fileSize.toString());
    }
    res.setHeader(
      "Content-Disposition",
      contentDispositionForFileName(download.fileName)
    );

    download.stream.pipe(res);
  };
};

// Streams an authorized final asset to the caller without buffering its bytes in application memory.
export const downloadFinalAsset = createDownloadFinalAssetHandler();
