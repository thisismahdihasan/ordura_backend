-- CreateTable
CREATE TABLE "ListingAssignment" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "listerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ListingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingResult" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "etsyListingUrl" TEXT,
    "listedById" TEXT NOT NULL,
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingAssignment_researchItemId_isCurrent_idx" ON "ListingAssignment"("researchItemId", "isCurrent");

-- CreateIndex
CREATE INDEX "ListingAssignment_listerId_idx" ON "ListingAssignment"("listerId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingResult_researchItemId_key" ON "ListingResult"("researchItemId");

-- CreateIndex
CREATE INDEX "ListingResult_listedById_idx" ON "ListingResult"("listedById");

-- CreateIndex
CREATE INDEX "ListingResult_listedAt_idx" ON "ListingResult"("listedAt");

-- AddForeignKey
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingAssignment" ADD CONSTRAINT "ListingAssignment_listerId_fkey" FOREIGN KEY ("listerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingResult" ADD CONSTRAINT "ListingResult_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingResult" ADD CONSTRAINT "ListingResult_listedById_fkey" FOREIGN KEY ("listedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
