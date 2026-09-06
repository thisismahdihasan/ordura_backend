-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('RESEARCHED', 'ASSIGNED', 'DESIGN_IN_PROGRESS', 'DESIGN_REVIEW', 'CORRECTION_NEEDED', 'ISSUE_REPORTED', 'DESIGN_APPROVED', 'READY_FOR_LISTING', 'LISTING_IN_PROGRESS', 'LISTED');

-- CreateTable
CREATE TABLE "ResearchItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "etsyListingId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "title" TEXT,
    "referenceImageUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "status" "ResearchStatus" NOT NULL DEFAULT 'RESEARCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchItem_createdById_idx" ON "ResearchItem"("createdById");

-- CreateIndex
CREATE INDEX "ResearchItem_status_idx" ON "ResearchItem"("status");

-- CreateIndex
CREATE INDEX "ResearchItem_createdAt_idx" ON "ResearchItem"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchItem_workspaceId_etsyListingId_key" ON "ResearchItem"("workspaceId", "etsyListingId");

-- AddForeignKey
ALTER TABLE "ResearchItem" ADD CONSTRAINT "ResearchItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchItem" ADD CONSTRAINT "ResearchItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
