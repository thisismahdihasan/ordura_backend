-- CreateTable
CREATE TABLE "FinalAsset" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinalAsset_driveFileId_key" ON "FinalAsset"("driveFileId");

-- CreateIndex
CREATE INDEX "FinalAsset_researchItemId_idx" ON "FinalAsset"("researchItemId");

-- CreateIndex
CREATE INDEX "FinalAsset_uploadedById_idx" ON "FinalAsset"("uploadedById");

-- CreateIndex
CREATE INDEX "FinalAsset_uploadedAt_idx" ON "FinalAsset"("uploadedAt");

-- AddForeignKey
ALTER TABLE "FinalAsset" ADD CONSTRAINT "FinalAsset_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalAsset" ADD CONSTRAINT "FinalAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
