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
    imageUrl: string;
    note: string | null;
    submittedAt: Date;
  };
};

export const NOTIFICATION_TYPE_DESIGN_REVIEW_SUBMITTED =
  "DESIGN_REVIEW_SUBMITTED" as const;


