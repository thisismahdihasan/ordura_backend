import { ResearchStatus } from "@prisma/client";

export type DesignerQueueResearchItem = {
  id: string;
  etsyListingId: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  referenceImageUrl: string | null;
  status: ResearchStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
};

export type DesignerWorkQueueItem = {
  assignmentId: string;
  assignedAt: Date;
  startedAt: Date | null;
  researchItem: DesignerQueueResearchItem;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DesignerWorkQueueResult = {
  items: DesignerWorkQueueItem[];
  pagination: PaginationMeta;
};

export type StartDesignWorkResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  assignment: {
    id: string;
    designerId: string;
    startedAt: Date | null;
    isCurrent: boolean;
  };
};

export type ReportDesignIssueResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  issueReport: {
    id: string;
    reason: string;
    details: string | null;
    createdAt: Date;
  };
};

export const NOTIFICATION_TYPE_DESIGN_ISSUE_REPORTED =
  "DESIGN_ISSUE_REPORTED" as const;

export type SubmitDesignReviewResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  reviewSubmission: {
    id: string;
    roundNumber: number;
    imageUrl: string | null;
    imageDeletedAt: Date | null;
    note: string | null;
    submittedAt: Date;
  };
};

export const NOTIFICATION_TYPE_DESIGN_REVIEW_SUBMITTED =
  "DESIGN_REVIEW_SUBMITTED" as const;

export type StartCorrectionResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
};

export type UploadedFinalAssetItem = {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
};

export type UploadFinalAssetsResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  finalAssets: UploadedFinalAssetItem[];
};

export type FinalAssetIncomingFile = {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
};

export type DriveUploadedFileMeta = {
  driveFileId: string;
  fileName: string;
  fileSize: bigint;
  mimeType: string;
};

export type FinalAssetStorageUploader = {
  verifyOrRecreateRootFolder: (params: {
    rootFolderId: string;
    workspaceName: string;
    refreshToken: string;
  }) => Promise<{ rootFolderId: string; recreated: boolean }>;
  createDesignFolder: (params: {
    folderName: string;
    parentFolderId: string;
    refreshToken: string;
  }) => Promise<string>;
  uploadFileStream: (params: {
    filePath: string;
    fileName: string;
    mimeType: string;
    parentFolderId: string;
    refreshToken: string;
  }) => Promise<DriveUploadedFileMeta>;
  deleteFileOrFolder: (params: {
    fileId: string;
    refreshToken: string;
  }) => Promise<void>;
};

export type CompleteDesignResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  finalAssetCount: number;
  completedAt: Date;
};
