-- CreateIndex
CREATE INDEX "Repo_orgId_idx" ON "Repo"("orgId");

-- CreateIndex
CREATE INDEX "RepoToConnection_repoId_connectionId_idx" ON "RepoToConnection"("repoId", "connectionId");
