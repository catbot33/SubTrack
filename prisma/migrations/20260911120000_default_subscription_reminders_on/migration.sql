-- New subscriptions should be protected by WhatsApp reminders by default.
-- Existing rows keep their current setting so prior user choices are preserved.
ALTER TABLE "Subscription"
ALTER COLUMN "reminderEnabled" SET DEFAULT true;
