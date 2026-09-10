CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "billingFrequency" TEXT,
    "renewalOrEndDate" TIMESTAMP(3),
    "amount" TEXT,
    "tag" TEXT NOT NULL DEFAULT 'subscription',
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Subscription_userEmail_source_sourceId_key" ON "Subscription"("userEmail", "source", "sourceId");
CREATE INDEX "Subscription_userEmail_renewalOrEndDate_idx" ON "Subscription"("userEmail", "renewalOrEndDate");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userEmail_fkey" FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
