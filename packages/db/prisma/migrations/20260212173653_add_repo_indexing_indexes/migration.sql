-- CreateIndex
CREATE INDEX "Repo_indexedAt_idx" ON "Repo"("indexedAt");

-- CreateIndex
CREATE INDEX "RepoIndexingJob_repoId_type_status_idx" ON "RepoIndexingJob"("repoId", "type", "status");
