-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN "designerAssignmentEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "designerAssignmentPausedUntil" TIMESTAMP(3),
ADD COLUMN "listerAssignmentEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "listerAssignmentPausedUntil" TIMESTAMP(3);
