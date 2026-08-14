-- CreateTable
CREATE TABLE "ScopedAccessToken" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "ScopedAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopedAccessTokenToRepo" (
    "tokenId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,

    CONSTRAINT "ScopedAccessTokenToRepo_pkey" PRIMARY KEY ("tokenId","repoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScopedAccessToken_hash_key" ON "ScopedAccessToken"("hash");

-- CreateIndex
CREATE INDEX "ScopedAccessToken_createdById_orgId_expiresAt_idx" ON "ScopedAccessToken"("createdById", "orgId", "expiresAt");

-- CreateIndex
CREATE INDEX "ScopedAccessToken_expiresAt_idx" ON "ScopedAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "ScopedAccessTokenToRepo_repoId_idx" ON "ScopedAccessTokenToRepo"("repoId");

-- AddForeignKey
ALTER TABLE "ScopedAccessToken" ADD CONSTRAINT "ScopedAccessToken_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedAccessToken" ADD CONSTRAINT "ScopedAccessToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedAccessTokenToRepo" ADD CONSTRAINT "ScopedAccessTokenToRepo_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "ScopedAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopedAccessTokenToRepo" ADD CONSTRAINT "ScopedAccessTokenToRepo_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
