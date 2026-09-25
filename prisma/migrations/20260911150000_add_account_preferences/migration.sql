ALTER TABLE "User"
ADD COLUMN "profileName" TEXT,
ADD COLUMN "profileAvatar" TEXT,
ADD COLUMN "monitoringPaused" BOOLEAN NOT NULL DEFAULT false;
