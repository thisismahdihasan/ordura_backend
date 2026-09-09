export type GoogleOAuthStatePayload = {
  workspaceId: string;
  adminId: string;
  nonce: string;
  purpose: "google_drive_oauth";
  connectionVersion: string | null;
};

export type GoogleDriveConnectionDetails = {
  id: string;
  googleAccountEmail: string | null;
  connectedById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GoogleDriveConnectionStatus = {
  isConnected: boolean;
  connection: GoogleDriveConnectionDetails | null;
};

export type GoogleDriveConnectUrlResponse = {
  authUrl: string;
};

export type GoogleOAuthTokens = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

export type GoogleDriveClientAdapter = {
  getAuthorizationUrl: (options: { state: string }) => string;
  exchangeCodeForTokens: (code: string) => Promise<GoogleOAuthTokens>;
  getAuthenticatedUserEmail: (accessToken: string) => Promise<string>;
  findOrCreateRootFolder: (options: {
    folderName: string;
    accessToken: string;
    existingRootFolderId?: string | null;
    isSameAccount: boolean;
  }) => Promise<{ rootFolderId: string; isReused: boolean }>;
};
