import { google } from "googleapis";
import { env } from "./env.js";
import { ApiError } from "../shared/ApiError.js";

export type GoogleOAuth2Client = InstanceType<typeof google.auth.OAuth2>;

// Returns true only when all four Google Drive configuration variables are fully provided and non-empty.
export const isGoogleDriveConfigured = (): boolean => {
  return Boolean(
    env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI &&
      env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
};

// Returns a configured Google OAuth2 client, or throws a controlled server error if not configured.
export const getGoogleOAuth2Client = (): GoogleOAuth2Client => {
  if (!isGoogleDriveConfigured()) {
    throw new ApiError(
      500,
      "Google Drive is not configured. Missing required credentials."
    );
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );
};
