import fs from "node:fs";
import { google } from "googleapis";
import { getGoogleOAuth2Client } from "../../config/googleDrive.js";
import { ApiError } from "../../shared/ApiError.js";
import {
  DriveUploadedFileMeta,
  FinalAssetStorageUploader,
} from "./designer.type.js";
import { sanitizeFinalAssetFileName } from "./designer.validation.js";

// Detects whether a Google Drive API error indicates revoked, expired, or invalid OAuth credentials
export const isGoogleAuthError = (err: unknown): boolean => {
  if (!err || typeof err !== "object") return false;
  const msg =
    "message" in err && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  const code = "code" in err ? (err as { code: unknown }).code : undefined;
  const respData =
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "data" in err.response
      ? (err.response as { data: unknown }).data
      : undefined;
  const responseStatus =
    "response" in err &&
    err.response &&
    typeof err.response === "object" &&
    "status" in err.response
      ? (err.response as { status?: unknown }).status
      : undefined;
  const errStr = `${JSON.stringify(respData ?? "")} ${msg}`.toLowerCase();
  return (
    errStr.includes("invalid_grant") ||
    errStr.includes("invalid_token") ||
    errStr.includes("invalid credentials") ||
    code === 401 ||
    responseStatus === 401
  );
};

// Maps Google Drive API errors to clean, controlled operational errors without leaking headers or tokens
export const handleGoogleDriveError = (
  err: unknown,
  fallbackMessage: string
): never => {
  if (err instanceof ApiError) throw err;
  if (isGoogleAuthError(err)) {
    throw new ApiError(409, "Google Drive connection needs to be reconnected.");
  }
  throw new ApiError(500, fallbackMessage);
};

// Production Google Drive storage adapter implementing the official googleapis v3 client
export const defaultFinalAssetStorageUploader: FinalAssetStorageUploader = {
  verifyOrRecreateRootFolder: async ({
    rootFolderId,
    workspaceName,
    refreshToken,
  }): Promise<{ rootFolderId: string; recreated: boolean }> => {
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    let needsRecreate = false;
    try {
      const existing = await drive.files.get({
        fileId: rootFolderId,
        fields: "id, trashed",
      });
      if (!existing.data.id || existing.data.trashed) {
        needsRecreate = true;
      }
    } catch (checkErr: unknown) {
      if (isGoogleAuthError(checkErr)) {
        throw new ApiError(
          409,
          "Google Drive connection needs to be reconnected."
        );
      }
      // If folder not found in Drive or deleted, proceed to recreate
      needsRecreate = true;
    }

    if (!needsRecreate) {
      return { rootFolderId, recreated: false };
    }

    try {
      const folderName = workspaceName
        ? `Ordura - ${workspaceName}`
        : "Ordura - Production";
      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });

      if (!created.data.id) {
        throw new ApiError(
          500,
          "Failed to recreate workspace root folder in Google Drive"
        );
      }

      return { rootFolderId: created.data.id, recreated: true };
    } catch (err: unknown) {
      return handleGoogleDriveError(
        err,
        "Failed to recreate workspace root folder in Google Drive"
      );
    }
  },

  createDesignFolder: async ({
    folderName,
    parentFolderId,
    refreshToken,
  }): Promise<string> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentFolderId],
        },
        fields: "id",
      });

      if (!created.data.id) {
        throw new ApiError(
          500,
          "Failed to create design folder in Google Drive"
        );
      }

      return created.data.id;
    } catch (err: unknown) {
      return handleGoogleDriveError(
        err,
        "Failed to create design folder in Google Drive"
      );
    }
  },

  uploadFileStream: async ({
    filePath,
    fileName,
    mimeType,
    parentFolderId,
    refreshToken,
  }): Promise<DriveUploadedFileMeta> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      const sanitizedName = sanitizeFinalAssetFileName(fileName);
      const stat = await fs.promises.stat(filePath);
      const fileSize = BigInt(stat.size);

      const fileStream = fs.createReadStream(filePath);

      const created = await drive.files.create({
        requestBody: {
          name: sanitizedName,
          parents: [parentFolderId],
        },
        media: {
          mimeType,
          body: fileStream,
        },
        fields: "id, name, mimeType",
      });

      if (!created.data.id) {
        throw new ApiError(500, "Failed to upload file to Google Drive");
      }

      return {
        driveFileId: created.data.id,
        fileName: sanitizedName,
        fileSize,
        mimeType,
      };
    } catch (err: unknown) {
      return handleGoogleDriveError(
        err,
        "Failed to upload file to Google Drive"
      );
    }
  },

  deleteFileOrFolder: async ({
    fileId,
    refreshToken,
  }): Promise<void> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth: oauth2Client });

      await drive.files.delete({ fileId });
    } catch (err: unknown) {
      if (isGoogleAuthError(err)) {
        throw new ApiError(
          409,
          "Google Drive connection needs to be reconnected."
        );
      }
      throw err;
    }
  },
};
