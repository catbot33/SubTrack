-- Persist Gmail watch cursors and AI findings until the user confirms them.
CREATE TABLE "GmailConnection" (
  "id" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "sealedTokens" TEXT NOT NULL,
  "historyId" TEXT,
  "watchExpiration" TIMESTAMP(3),
  "watchStatus" TEXT NOT NULL DEFAULT 'pending',
  "lastWebhookAt" TIMESTAMP(3),
  "lastSyncAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReviewCandidate" (
  "id" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "emailId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "tag" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "amount" TEXT,
  "billingFrequency" TEXT,
  "renewalOrEndDate" TIMESTAMP(3),
  "summary" TEXT NOT NULL,
  "evidence" JSONB,
  "merchantInference" TEXT,
  "renewalEstimate" JSONB,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source" TEXT NOT NULL DEFAULT 'gmail_webhook',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GmailWebhookEvent" (
  "id" TEXT NOT NULL,
  "emailAddress" TEXT NOT NULL,
  "historyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GmailWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GmailConnection_userEmail_key" ON "GmailConnection"("userEmail");
CREATE UNIQUE INDEX "ReviewCandidate_userEmail_emailId_key" ON "ReviewCandidate"("userEmail", "emailId");
CREATE INDEX "ReviewCandidate_userEmail_status_receivedAt_idx" ON "ReviewCandidate"("userEmail", "status", "receivedAt");
CREATE INDEX "GmailWebhookEvent_status_createdAt_idx" ON "GmailWebhookEvent"("status", "createdAt");

ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewCandidate" ADD CONSTRAINT "ReviewCandidate_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
