export type DashboardDatePreset =
  | "all"
  | "today"
  | "week"
  | "month"
  | "custom";

export type ResolvedDashboardDateRange = {
  preset: DashboardDatePreset;
  dateFrom: string | null;
  dateTo: string | null;
};

export type DashboardPipelineCounts = {
  researched: number;
  assigned: number;
  designInProgress: number;
  designReview: number;
  correctionNeeded: number;
  issueReported: number;
  designApproved: number;
  readyForListing: number;
  listingInProgress: number;
  listed: number;
};

export type DashboardOverviewResult = {
  dateRange: ResolvedDashboardDateRange;
  totalResearch: number;
  pipeline: DashboardPipelineCounts;
};

export type ResearcherPerformanceRow = {
  userId: string;
  name: string | null;
  email: string;
  researchCount: number;
};

export type ResearcherPerformanceResult = {
  dateRange: ResolvedDashboardDateRange;
  researchers: ResearcherPerformanceRow[];
};

export type DesignerPerformanceRow = {
  userId: string;
  name: string | null;
  email: string;
  assignedCount: number;
  currentInProgress: number;
  submittedCount: number;
  approvedCount: number;
  correctionsCount: number;
  completedCount: number;
};

export type DesignerPerformanceResult = {
  dateRange: ResolvedDashboardDateRange;
  designers: DesignerPerformanceRow[];
};
