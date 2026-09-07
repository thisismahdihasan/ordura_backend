import { ResearchStatus } from "@prisma/client";

export type ParsedEtsyListing = {
  originalUrl: string;
  normalizedUrl: string;
  etsyListingId: string;
};

export type EtsyMetadata = {
  title: string | null;
  referenceImageUrl: string | null;
};

export type SafeResearchItem = {
  id: string;
  workspaceId: string;
  etsyListingId: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  referenceImageUrl: string | null;
  status: ResearchStatus;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DuplicateCreatorInfo = {
  id: string;
  name: string | null;
  email: string;
};

export type DuplicateResearchItemData = {
  alreadyExists: true;
  researchItemId: string;
  createdBy: DuplicateCreatorInfo;
  currentStatus: ResearchStatus;
  createdAt: Date;
};

export type SafeResearchItemListItem = {
  id: string;
  workspaceId: string;
  etsyListingId: string;
  originalUrl: string;
  normalizedUrl: string;
  title: string | null;
  referenceImageUrl: string | null;
  status: ResearchStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: DuplicateCreatorInfo;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ResearchItemListResult = {
  items: SafeResearchItemListItem[];
  pagination: PaginationMeta;
};
