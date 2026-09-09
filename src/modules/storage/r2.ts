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

// Uploads a stream to Ordura's private R2 bucket without materializing it in memory.
export const uploadObject = async ({
  storageKey,
  body,
  mimeType,
}: UploadObjectInput): Promise<void> => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: storageKey,
      Body: body,
      ContentType: mimeType,
    })
  );
};

// Retrieves an R2 object as a Node stream for backend-mediated downloads.
export const getObjectStream = async (storageKey: string): Promise<Readable> => {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: storageKey,
    })
  );

  if (!(response.Body instanceof Readable)) {
    throw new ApiError(500, "R2 did not return a file stream");
  }

  return response.Body;
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
