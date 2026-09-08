export type ReviewAnnotationCreatedBy = {
  id: string;
  name: string | null;
};

export type ReviewAnnotationItem = {
  id: string;
  reviewSubmissionId: string;
  x: number;
  y: number;
  comment: string;
  resolved: boolean;
  createdAt: Date;
  createdBy: ReviewAnnotationCreatedBy;
};

export type CreateReviewAnnotationResult = {
  annotation: ReviewAnnotationItem;
};
