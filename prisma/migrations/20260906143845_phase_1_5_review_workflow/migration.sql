-- CreateTable
CREATE TABLE "ReviewSubmission" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imagePublicId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAnnotation" (
    "id" TEXT NOT NULL,
    "reviewSubmissionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "comment" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnotationReply" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnotationReply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewSubmission_designerId_idx" ON "ReviewSubmission"("designerId");

-- CreateIndex
CREATE INDEX "ReviewSubmission_submittedAt_idx" ON "ReviewSubmission"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewSubmission_researchItemId_roundNumber_key" ON "ReviewSubmission"("researchItemId", "roundNumber");

-- CreateIndex
CREATE INDEX "ReviewAnnotation_reviewSubmissionId_idx" ON "ReviewAnnotation"("reviewSubmissionId");

-- CreateIndex
CREATE INDEX "ReviewAnnotation_createdById_idx" ON "ReviewAnnotation"("createdById");

-- CreateIndex
CREATE INDEX "ReviewAnnotation_resolved_idx" ON "ReviewAnnotation"("resolved");

-- CreateIndex
CREATE INDEX "AnnotationReply_annotationId_idx" ON "AnnotationReply"("annotationId");

-- CreateIndex
CREATE INDEX "AnnotationReply_createdById_idx" ON "AnnotationReply"("createdById");

-- CreateIndex
CREATE INDEX "AnnotationReply_createdAt_idx" ON "AnnotationReply"("createdAt");

-- AddForeignKey
ALTER TABLE "ReviewSubmission" ADD CONSTRAINT "ReviewSubmission_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSubmission" ADD CONSTRAINT "ReviewSubmission_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnnotation" ADD CONSTRAINT "ReviewAnnotation_reviewSubmissionId_fkey" FOREIGN KEY ("reviewSubmissionId") REFERENCES "ReviewSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewAnnotation" ADD CONSTRAINT "ReviewAnnotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationReply" ADD CONSTRAINT "AnnotationReply_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "ReviewAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnotationReply" ADD CONSTRAINT "AnnotationReply_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
