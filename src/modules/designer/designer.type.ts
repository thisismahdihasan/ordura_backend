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
