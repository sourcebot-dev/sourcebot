-- AlterTable
ALTER TABLE "Repo" ADD COLUMN "firstIndexingJobFinishedAt" TIMESTAMP(3);

-- Existing successful indexes have already reached a terminal state.
UPDATE "Repo"
SET "firstIndexingJobFinishedAt" = "indexedAt"
WHERE "indexedAt" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Repo_orgId_firstIndexingJobFinishedAt_idx"
ON "Repo"("orgId", "firstIndexingJobFinishedAt");
