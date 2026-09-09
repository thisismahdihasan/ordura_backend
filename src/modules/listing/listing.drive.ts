import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleOAuth2Client } from "../../config/googleDrive.js";
import { ApiError } from "../../shared/ApiError.js";
import { isGoogleAuthError } from "../designer/designer.drive.js";
import { FinalAssetDownloader } from "./listing.type.js";

type GoogleErrorResponse = {
  status?: unknown;
  data?: unknown;
};

type GoogleErrorLike = {
  code?: unknown;
  response?: GoogleErrorResponse;
};

const asGoogleErrorLike = (value: unknown): GoogleErrorLike | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as GoogleErrorLike;
};

// Identifies a missing or inaccessible Drive file without exposing provider details.
const isGoogleDriveFileMissingError = (error: unknown): boolean => {
  const googleError = asGoogleErrorLike(error);
  if (!googleError) {
    return false;
  }

  return googleError.code === 404 || googleError.response?.status === 404;
};

// Converts Drive download errors into the small, safe error surface of this endpoint.
export const mapFinalAssetDownloadError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (isGoogleAuthError(error)) {
    return new ApiError(409, "Google Drive connection needs to be reconnected.");
  }

  if (isGoogleDriveFileMissingError(error)) {
    return new ApiError(
      404,
      "The requested file is no longer available in Google Drive."
    );
  }

  return new ApiError(500, "Failed to download file from Google Drive.");
};

// Production adapter that obtains a Drive media stream without materializing file bytes in memory.
export const defaultFinalAssetDownloader: FinalAssetDownloader = {
  getDownloadStream: async ({ driveFileId, refreshToken }): Promise<Readable> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const drive = google.drive({ version: "v3", auth: oauth2Client });
      const response = await drive.files.get(
        {
          fileId: driveFileId,
          alt: "media",
        },
        {
          responseType: "stream",
        }
      );

      if (!(response.data instanceof Readable)) {
        throw new ApiError(500, "Google Drive did not return a file stream.");
      }

      return response.data;
    } catch (error: unknown) {
      throw mapFinalAssetDownloadError(error);
    }
  },
};
