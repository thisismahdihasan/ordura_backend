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
