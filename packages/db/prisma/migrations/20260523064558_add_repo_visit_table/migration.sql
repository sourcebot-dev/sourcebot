-- CreateTable
CREATE TABLE "RepoVisit" (
    "id" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPromotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repoId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "RepoVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RepoVisit_userId_orgId_visitedAt_idx" ON "RepoVisit"("userId", "orgId", "visitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RepoVisit_repoId_userId_key" ON "RepoVisit"("repoId", "userId");

-- AddForeignKey
ALTER TABLE "RepoVisit" ADD CONSTRAINT "RepoVisit_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoVisit" ADD CONSTRAINT "RepoVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoVisit" ADD CONSTRAINT "RepoVisit_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
