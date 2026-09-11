ALTER TABLE "WorkspaceInvite"
ADD COLUMN "lastSentAt" TIMESTAMP(3),
ADD COLUMN "lastMessageId" TEXT,
ADD COLUMN "lastSmtpResponse" TEXT,
ADD COLUMN "lastAccepted" JSONB,
ADD COLUMN "lastRejected" JSONB;
