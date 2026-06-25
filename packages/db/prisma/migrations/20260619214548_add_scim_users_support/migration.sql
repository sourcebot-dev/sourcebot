-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "isScimEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserToOrg" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "scimExternalId" TEXT;

-- CreateTable
CREATE TABLE "ScimToken" (
    "name" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "ScimToken_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScimToken_hash_key" ON "ScimToken"("hash");

-- CreateIndex
CREATE INDEX "ScimToken_orgId_idx" ON "ScimToken"("orgId");

-- CreateIndex
CREATE INDEX "UserToOrg_orgId_scimExternalId_idx" ON "UserToOrg"("orgId", "scimExternalId");

-- AddForeignKey
ALTER TABLE "ScimToken" ADD CONSTRAINT "ScimToken_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
