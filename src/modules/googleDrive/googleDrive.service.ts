import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { google } from "googleapis";
import { WorkspaceRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { getGoogleOAuth2Client } from "../../config/googleDrive.js";
import prisma from "../../lib/prisma.js";
import { ApiError } from "../../shared/ApiError.js";
import { encryptGoogleRefreshToken } from "./googleDrive.crypto.js";
import {
  GoogleDriveClientAdapter,
  GoogleDriveConnectionStatus,
  GoogleDriveConnectUrlResponse,
  GoogleOAuthStatePayload,
  GoogleOAuthTokens,
} from "./googleDrive.type.js";

// Default adapter implementing real Google APIs using official googleapis library.
export const defaultGoogleDriveAdapter: GoogleDriveClientAdapter = {
  getAuthorizationUrl: ({ state }: { state: string }): string => {
    const oauth2Client = getGoogleOAuth2Client();
    return oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
    });
  },

  exchangeCodeForTokens: async (code: string): Promise<GoogleOAuthTokens> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      const { tokens } = await oauth2Client.getToken(code);
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    } catch {
      throw new ApiError(400, "Failed to exchange authorization code with Google");
    }
  },

  getAuthenticatedUserEmail: async (accessToken: string): Promise<string> => {
    try {
      const oauth2Client = getGoogleOAuth2Client();
      oauth2Client.setCredentials({ access_token: accessToken });
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const email = userInfo.data.email?.toLowerCase().trim();
      if (!email) {
        throw new ApiError(500, "Unable to determine Google account email address");
      }
      return email;
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, "Failed to fetch Google user profile email");
    }
  },

  findOrCreateRootFolder: async ({
    folderName,
    accessToken,
    existingRootFolderId,
    isSameAccount,
  }: {
    folderName: string;
    accessToken: string;
    existingRootFolderId?: string | null;
    isSameAccount: boolean;
  }): Promise<{ rootFolderId: string; isReused: boolean }> => {
    const oauth2Client = getGoogleOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: "v3", auth: oauth2Client });

    if (isSameAccount && existingRootFolderId) {
      try {
        const existing = await drive.files.get({
          fileId: existingRootFolderId,
          fields: "id, trashed",
        });
        if (existing.data.id && !existing.data.trashed) {
          return { rootFolderId: existing.data.id, isReused: true };
        }
      } catch {
        // Stored folder missing, inaccessible, or trashed in Drive; proceed to recreate
      }
    }

    try {
      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });

      if (!created.data.id) {
        throw new ApiError(500, "Failed to create root folder in Google Drive");
      }

      return { rootFolderId: created.data.id, isReused: false };
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(500, "Failed to create root folder in Google Drive");
    }
  },
};

// Generates Google Drive OAuth connect URL and security nonce for an authenticated admin.
export const generateGoogleDriveConnectUrl = async (
  workspaceId: string,
  adminId: string,
  adapter: GoogleDriveClientAdapter = defaultGoogleDriveAdapter
): Promise<{ authUrl: string; nonce: string }> => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      googleDriveConnection: {
        select: {
          id: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new ApiError(404, "Workspace not found");
  }

  const connectionVersion = workspace.googleDriveConnection
    ? workspace.googleDriveConnection.updatedAt.toISOString()
    : null;

  const nonce = crypto.randomBytes(16).toString("hex");

  const statePayload: GoogleOAuthStatePayload = {
    workspaceId,
    adminId,
    nonce,
    purpose: "google_drive_oauth",
    connectionVersion,
  };

  const state = jwt.sign(statePayload, env.JWT_SECRET, {
    expiresIn: "10m",
  });

  const authUrl = adapter.getAuthorizationUrl({ state });

  return { authUrl, nonce };
};

// Handles Google OAuth callback: verifies state, nonce, admin role, exchanges tokens, and persists connection.
export const handleGoogleDriveCallback = async (params: {
  code?: string;
  state?: string;
  error?: string;
  cookieNonce?: string;
  adapter?: GoogleDriveClientAdapter;
}): Promise<{
  workspaceId: string;
  connection: {
    id: string;
    googleAccountEmail: string | null;
    connectedById: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}> => {
  const { code, state, error, cookieNonce, adapter = defaultGoogleDriveAdapter } = params;

  if (error) {
    throw new ApiError(400, "Google Drive authorization was denied or cancelled");
  }

  if (!code || !state) {
    throw new ApiError(400, "Authorization code and state are required");
  }

  let decoded: GoogleOAuthStatePayload;
  try {
    decoded = jwt.verify(state, env.JWT_SECRET) as GoogleOAuthStatePayload;
  } catch {
    throw new ApiError(400, "Invalid or expired OAuth state");
  }

  if (
    decoded.purpose !== "google_drive_oauth" ||
    !decoded.workspaceId ||
    !decoded.adminId ||
    !decoded.nonce
  ) {
    throw new ApiError(400, "Malformed OAuth state payload");
  }

  if (!cookieNonce || cookieNonce !== decoded.nonce) {
    throw new ApiError(
      400,
      "OAuth security verification failed: missing or mismatched state nonce"
    );
  }

  // Re-verify that initiating user still possesses active ADMIN role in target workspace
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: decoded.workspaceId,
        userId: decoded.adminId,
      },
    },
    select: { roles: true },
  });

  if (!membership || !membership.roles.includes(WorkspaceRole.ADMIN)) {
    throw new ApiError(
      403,
      "You no longer have ADMIN permissions in this workspace"
    );
  }

  // Stale/concurrent callback protection: verify connection hasn't changed since flow initiated
  const currentConnection = await prisma.googleDriveConnection.findUnique({
    where: { workspaceId: decoded.workspaceId },
    select: {
      id: true,
      encryptedRefreshToken: true,
      rootFolderId: true,
      googleAccountEmail: true,
      updatedAt: true,
    },
  });

  const currentVersion = currentConnection
    ? currentConnection.updatedAt.toISOString()
    : null;

  if (currentVersion !== decoded.connectionVersion) {
    throw new ApiError(
      409,
      "Google Drive connection was modified since this authorization flow was initiated. Please reconnect."
    );
  }

  // Exchange authorization code for tokens
  const tokens = await adapter.exchangeCodeForTokens(code);
  const accessToken = tokens.accessToken;
  const newRefreshToken = tokens.refreshToken;

  if (!accessToken) {
    throw new ApiError(500, "Failed to retrieve access token from Google");
  }

  // Determine Google account email (normalized to lowercase)
  const rawGoogleEmail = await adapter.getAuthenticatedUserEmail(accessToken);
  const googleAccountEmail = rawGoogleEmail.toLowerCase().trim();

  const isFirstConnection = !currentConnection;
  const isSameAccount =
    !isFirstConnection &&
    currentConnection.googleAccountEmail?.toLowerCase() === googleAccountEmail.toLowerCase();

  let refreshTokenToEncrypt: string | null = null;
  let finalEncryptedRefreshToken = "";

  if (isFirstConnection) {
    if (!newRefreshToken) {
      throw new ApiError(
        400,
        "Google did not provide an offline refresh token. Please grant full offline consent and reconnect."
      );
    }
    refreshTokenToEncrypt = newRefreshToken;
  } else if (isSameAccount) {
    if (newRefreshToken) {
      refreshTokenToEncrypt = newRefreshToken;
    } else {
      finalEncryptedRefreshToken = currentConnection.encryptedRefreshToken;
    }
  } else {
    // Different account replacement
    if (!newRefreshToken) {
      throw new ApiError(
        400,
        "Google did not provide a refresh token for the new Google account. Please revoke prior permissions in Google account settings and reconnect."
      );
    }
    refreshTokenToEncrypt = newRefreshToken;
  }

  if (refreshTokenToEncrypt) {
    finalEncryptedRefreshToken = encryptGoogleRefreshToken(refreshTokenToEncrypt);
  }

  // Determine workspace root folder
  const workspace = await prisma.workspace.findUnique({
    where: { id: decoded.workspaceId },
    select: { name: true },
  });

  const folderName = workspace?.name
    ? `Ordura - ${workspace.name}`
    : "Ordura - Production";

  const { rootFolderId } = await adapter.findOrCreateRootFolder({
    folderName,
    accessToken,
    existingRootFolderId: isSameAccount ? currentConnection.rootFolderId : null,
    isSameAccount,
  });

  // Persist connection atomically in database
  const savedConnection = await prisma.googleDriveConnection.upsert({
    where: { workspaceId: decoded.workspaceId },
    create: {
      workspaceId: decoded.workspaceId,
      encryptedRefreshToken: finalEncryptedRefreshToken,
      rootFolderId,
      googleAccountEmail,
      connectedById: decoded.adminId,
    },
    update: {
      encryptedRefreshToken: finalEncryptedRefreshToken,
      rootFolderId,
      googleAccountEmail,
      connectedById: decoded.adminId,
    },
    select: {
      id: true,
      googleAccountEmail: true,
      connectedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    workspaceId: decoded.workspaceId,
    connection: savedConnection,
  };
};

// Fetches sanitized Google Drive connection status for workspace settings.
export const getGoogleDriveConnectionStatus = async (
  workspaceId: string
): Promise<GoogleDriveConnectionStatus> => {
  const connection = await prisma.googleDriveConnection.findUnique({
    where: { workspaceId },
    select: {
      id: true,
      googleAccountEmail: true,
      connectedById: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!connection) {
    return {
      isConnected: false,
      connection: null,
    };
  }

  return {
    isConnected: true,
    connection,
  };
};
