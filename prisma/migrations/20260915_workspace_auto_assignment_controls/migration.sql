-- AlterTable
ALTER TABLE "Workspace" 
  ADD COLUMN "designerAutoAssignmentEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "listerAutoAssignmentEnabled" BOOLEAN NOT NULL DEFAULT true;
