-- Correct the final-asset provider identifier while preserving existing uniqueness.
ALTER TABLE "FinalAsset" RENAME COLUMN "driveFileId" TO "storageKey";
ALTER INDEX "FinalAsset_driveFileId_key" RENAME TO "FinalAsset_storageKey_key";

-- This table exists in the deployed database but not in the committed migration history.
-- The conditional removal keeps both upgrade and fresh-database migration paths valid.
DROP TABLE IF EXISTS "GoogleDriveConnection";
