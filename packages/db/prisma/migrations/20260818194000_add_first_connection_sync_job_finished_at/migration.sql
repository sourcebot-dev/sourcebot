-- AlterTable
ALTER TABLE "Connection" ADD COLUMN "firstSyncJobFinishedAt" TIMESTAMP(3);

-- Existing successful syncs have already reached a terminal state.
UPDATE "Connection"
SET "firstSyncJobFinishedAt" = "syncedAt"
WHERE "syncedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Connection_orgId_firstSyncJobFinishedAt_idx"
ON "Connection"("orgId", "firstSyncJobFinishedAt");
