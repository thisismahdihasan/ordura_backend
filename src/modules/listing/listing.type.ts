import { ResearchStatus } from "@prisma/client";
import { Readable } from "node:stream";

export const NOTIFICATION_TYPE_LISTING_ASSIGNED = "LISTING_ASSIGNED" as const;

export type ListerWorkload = {
  userId: string;
  createdAt: Date;
  activeWorkload: number;
};

export type AssignListerResult = {
  assignmentId: string;
  listerId: string;
  assignedAt: Date;
  isNew: boolean;
} | null;

export type BackfillListingResult = {
  backfilledCount: number;
  assignedItemIds: string[];
};

export type ListerQueueResearchItem = {
  id: string;
  etsyListingId: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  referenceImageUrl: string | null;
  status: ResearchStatus;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
};

export type ListerQueuePreview = {
  imageUrl: string;
  roundNumber: number;
  approvedAt: Date;
} | null;

export type ListerQueueFinalAsset = {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
};

export type ListerWorkQueueItem = {
  assignmentId: string;
  assignedAt: Date;
  startedAt: Date | null;
  researchItem: ListerQueueResearchItem;
  preview: ListerQueuePreview;
  finalAssets: ListerQueueFinalAsset[];
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListerWorkQueueResult = {
  items: ListerWorkQueueItem[];
  pagination: PaginationMeta;
};

export type StartListingResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  assignment: {
    id: string;
    startedAt: Date;
  };
};

export type FinalAssetDownloadDescriptor = {
  fileName: string;
  fileSize: bigint;
  mimeType: string;
  stream: Readable;
};

export type CompleteListingResult = {
  researchItem: {
    id: string;
    status: ResearchStatus;
  };
  assignment: {
    id: string;
    completedAt: Date;
  };
  listingResult: {
    id: string;
    etsyListingUrl: string | null;
    listedAt: Date;
  };
};
