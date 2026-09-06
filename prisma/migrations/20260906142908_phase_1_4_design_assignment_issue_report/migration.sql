-- CreateTable
CREATE TABLE "DesignAssignment" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "designerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DesignAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL,
    "researchItemId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DesignAssignment_researchItemId_isCurrent_idx" ON "DesignAssignment"("researchItemId", "isCurrent");

-- CreateIndex
CREATE INDEX "DesignAssignment_designerId_idx" ON "DesignAssignment"("designerId");

-- CreateIndex
CREATE INDEX "IssueReport_researchItemId_idx" ON "IssueReport"("researchItemId");

-- CreateIndex
CREATE INDEX "IssueReport_reportedById_idx" ON "IssueReport"("reportedById");

-- CreateIndex
CREATE INDEX "IssueReport_resolvedById_idx" ON "IssueReport"("resolvedById");

-- CreateIndex
CREATE INDEX "IssueReport_resolvedAt_idx" ON "IssueReport"("resolvedAt");

-- AddForeignKey
ALTER TABLE "DesignAssignment" ADD CONSTRAINT "DesignAssignment_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignAssignment" ADD CONSTRAINT "DesignAssignment_designerId_fkey" FOREIGN KEY ("designerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_researchItemId_fkey" FOREIGN KEY ("researchItemId") REFERENCES "ResearchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
