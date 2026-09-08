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

export type AnnotationReplyCreatedBy = {
  id: string;
  name: string | null;
};

export type AnnotationReplyItem = {
  id: string;
  annotationId: string;
  message: string;
  createdAt: Date;
  createdBy: AnnotationReplyCreatedBy;
};

export type CreateAnnotationReplyResult = {
  reply: AnnotationReplyItem;
};
