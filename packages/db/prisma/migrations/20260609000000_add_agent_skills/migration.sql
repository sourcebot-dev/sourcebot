-- CreateEnum
CREATE TYPE "AgentSkillVisibility" AS ENUM ('PERSONAL', 'ORG');

-- CreateTable
CREATE TABLE "AgentSkill" (
    "id" TEXT NOT NULL,
    "visibility" "AgentSkillVisibility" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "orgId" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_visibility_scopeId_slug_key" ON "AgentSkill"("visibility", "scopeId", "slug");

-- CreateIndex
CREATE INDEX "AgentSkill_createdById_idx" ON "AgentSkill"("createdById");

-- CreateIndex
CREATE INDEX "AgentSkill_orgId_idx" ON "AgentSkill"("orgId");

-- CreateIndex
CREATE INDEX "AgentSkill_visibility_scopeId_idx" ON "AgentSkill"("visibility", "scopeId");

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
