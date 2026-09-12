-- Persist the owning workspace on every notification so list and mutation
-- operations can enforce workspace boundaries independently of ResearchItem.
ALTER TABLE "Notification" ADD COLUMN "workspaceId" TEXT;

-- All notification producers historically attached a ResearchItem. Backfill
-- from that authoritative relation without guessing workspace identifiers.
UPDATE "Notification" AS notification
SET "workspaceId" = research_item."workspaceId"
FROM "ResearchItem" AS research_item
WHERE notification."researchItemId" = research_item."id";

-- Abort before the NOT NULL constraint if historical data cannot be resolved.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Notification" WHERE "workspaceId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require Notification.workspaceId: unresolved historical notifications exist';
  END IF;
END $$;

ALTER TABLE "Notification" ALTER COLUMN "workspaceId" SET NOT NULL;

DROP INDEX "Notification_userId_isRead_idx";
DROP INDEX "Notification_createdAt_idx";

CREATE INDEX "Notification_userId_workspaceId_createdAt_idx"
  ON "Notification"("userId", "workspaceId", "createdAt");
CREATE INDEX "Notification_userId_workspaceId_isRead_idx"
  ON "Notification"("userId", "workspaceId", "isRead");
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
