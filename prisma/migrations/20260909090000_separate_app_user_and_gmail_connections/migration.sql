-- A SubTrack account can monitor multiple Gmail inboxes without changing its login identity.
ALTER TABLE "GmailConnection" DROP CONSTRAINT "GmailConnection_userEmail_fkey";
DROP INDEX "GmailConnection_userEmail_key";
ALTER TABLE "GmailConnection" RENAME COLUMN "userEmail" TO "ownerEmail";
ALTER TABLE "GmailConnection" ADD COLUMN "gmailEmail" TEXT;
UPDATE "GmailConnection" SET "gmailEmail" = "ownerEmail";
ALTER TABLE "GmailConnection" ALTER COLUMN "gmailEmail" SET NOT NULL;
CREATE UNIQUE INDEX "GmailConnection_gmailEmail_key" ON "GmailConnection"("gmailEmail");
CREATE INDEX "GmailConnection_ownerEmail_idx" ON "GmailConnection"("ownerEmail");
ALTER TABLE "GmailConnection" ADD CONSTRAINT "GmailConnection_ownerEmail_fkey" FOREIGN KEY ("ownerEmail") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;
