ALTER TABLE "User"
  ADD COLUMN "whatsappNumber" TEXT,
  ADD COLUMN "whatsappConnectedAt" TIMESTAMP(3),
  ADD COLUMN "reminderLeadDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "timeZone" TEXT NOT NULL DEFAULT 'Asia/Karachi';

CREATE TABLE "ReminderDelivery" (
  "id" TEXT NOT NULL,
  "userEmail" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "kind" TEXT NOT NULL,
  "deliveryKey" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReminderDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReminderDelivery_deliveryKey_key" ON "ReminderDelivery"("deliveryKey");
CREATE INDEX "ReminderDelivery_status_scheduledFor_idx" ON "ReminderDelivery"("status", "scheduledFor");
CREATE INDEX "ReminderDelivery_userEmail_createdAt_idx" ON "ReminderDelivery"("userEmail", "createdAt");
CREATE INDEX "ReminderDelivery_subscriptionId_idx" ON "ReminderDelivery"("subscriptionId");

ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_userEmail_fkey"
  FOREIGN KEY ("userEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReminderDelivery" ADD CONSTRAINT "ReminderDelivery_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
