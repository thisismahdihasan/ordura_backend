import crypto from "node:crypto";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { r2Client } from "../../config/r2.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../shared/ApiError.js";
import { sanitizeFinalAssetFileName } from "../designer/designer.validation.js";

export type BuildFinalAssetKeyInput = {
  workspaceId: string;
  researchItemId: string;
  fileName: string;
};

export type UploadObjectInput = {
  storageKey: string;
  body: Readable;
  mimeType: string;
  contentLength?: number;
};

const missingObjectErrorNames = new Set(["NoSuchKey", "NotFound"]);
const unavailableStorageErrorNames = new Set([
  "AccessDenied",
  "CredentialsProviderError",
  "InvalidAccessKeyId",
  "SignatureDoesNotMatch",
]);

// Converts provider failures into safe API errors without exposing R2 details.
export const mapR2DownloadError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error && missingObjectErrorNames.has(error.name)) {
    return new ApiError(404, "The requested file is no longer available.");
  }

  if (error instanceof Error && unavailableStorageErrorNames.has(error.name)) {
    return new ApiError(503, "Storage service is unavailable.");
  }

  return new ApiError(502, "Failed to retrieve file from storage.");
};

// Builds an R2 key using stable internal IDs and a sanitized, collision-resistant file name.
export const buildFinalAssetKey = ({
  workspaceId,
  researchItemId,
  fileName,
}: BuildFinalAssetKeyInput): string => {
  const safeFileName = sanitizeFinalAssetFileName(fileName);

  return `workspaces/${workspaceId}/research-items/${researchItemId}/${crypto.randomUUID()}-${safeFileName}`;
};

// Uploads a stream to StoreOps' private R2 bucket without materializing it in memory.
export const uploadObject = async ({
  storageKey,
  body,
  mimeType,
  contentLength,
}: UploadObjectInput): Promise<void> => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
      ContentLength: contentLength,
    })
  );
};

// Retrieves an R2 object as a Node stream for backend-mediated downloads.
export const getObjectStream = async (storageKey: string): Promise<Readable> => {
  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: storageKey,
      })
    );

    if (!(response.Body instanceof Readable)) {
      throw new ApiError(502, "Failed to retrieve file from storage.");
    }

    return response.Body;
  } catch (error) {
    throw mapR2DownloadError(error);
  }
};

// Deletes only a known object key, for rollback of a failed future upload request.
export const deleteObject = async (storageKey: string): Promise<void> => {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: storageKey,
    })
  );
};
