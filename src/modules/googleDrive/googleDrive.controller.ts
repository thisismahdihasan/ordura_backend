import { Request, Response } from "express";
import { env } from "../../config/env.js";
import { WorkspaceAuthorizedRequest } from "../../middleware/requireWorkspaceRole.js";
import { ApiResponse } from "../../shared/ApiResponse.js";
import * as googleDriveService from "./googleDrive.service.js";
import {
  googleDriveCallbackQuerySchema,
  googleDriveWorkspaceParamsSchema,
} from "./googleDrive.validation.js";

const NONCE_COOKIE_NAME = "ordura_google_oauth_nonce";

// Generates Google Drive OAuth connect URL and sets temporary security nonce cookie.
export const getConnectUrl = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = googleDriveWorkspaceParamsSchema.parse(req.params);
  const authReq = req as WorkspaceAuthorizedRequest;
  const adminId = authReq.user.id;

  const { authUrl, nonce } =
    await googleDriveService.generateGoogleDriveConnectUrl(workspaceId, adminId);

  res.cookie(NONCE_COOKIE_NAME, nonce, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Google Drive authorization URL generated",
    data: { authUrl },
  });
};

// Handles OAuth callback from Google: verifies state, nonce, exchanges tokens, and redirects or responds.
export const handleCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const query = googleDriveCallbackQuerySchema.parse(req.query);
  const cookieNonce = req.cookies?.[NONCE_COOKIE_NAME];

  // Immediately clear the one-time security nonce cookie to prevent replay
  res.clearCookie(NONCE_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  const prefersJson = req.headers.accept?.includes("application/json");

  try {
    const result = await googleDriveService.handleGoogleDriveCallback({
      code: query.code,
      state: query.state,
      error: query.error,
      cookieNonce,
    });

    if (prefersJson) {
      ApiResponse.success(res, {
        statusCode: 200,
        message: "Google Drive connected successfully",
        data: result,
      });
      return;
    }

    res.redirect(
      302,
      `${env.FRONTEND_URL}/settings?googleDrive=connected&workspaceId=${result.workspaceId}`
    );
  } catch (err: unknown) {
    if (prefersJson) {
      throw err;
    }

    const message =
      err instanceof Error
        ? err.message
        : "Failed to connect Google Drive";

    res.redirect(
      302,
      `${env.FRONTEND_URL}/settings?googleDrive=error&reason=${encodeURIComponent(message)}`
    );
  }
};

// Retrieves current workspace Google Drive connection status.
export const getConnectionStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { workspaceId } = googleDriveWorkspaceParamsSchema.parse(req.params);

  const status =
    await googleDriveService.getGoogleDriveConnectionStatus(workspaceId);

  ApiResponse.success(res, {
    statusCode: 200,
    message: "Google Drive connection status retrieved",
    data: status,
  });
};
