-- CreateEnum
CREATE TYPE "AgentSkillVisibility" AS ENUM ('PERSONAL', 'SHARED');

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
    "updatedById" TEXT,
    "orgId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "autoEnrolled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSkillAdoption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "agentSkillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "AgentSkillAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentSkill_createdById_idx" ON "AgentSkill"("createdById");

-- CreateIndex
CREATE INDEX "AgentSkill_updatedById_idx" ON "AgentSkill"("updatedById");

-- CreateIndex
CREATE INDEX "AgentSkill_orgId_idx" ON "AgentSkill"("orgId");

-- CreateIndex
CREATE INDEX "AgentSkill_orgId_visibility_scopeId_idx" ON "AgentSkill"("orgId", "visibility", "scopeId");

-- CreateIndex
CREATE INDEX "AgentSkill_shared_catalog_idx" ON "AgentSkill"("orgId", "visibility", "scopeId", "enabled", "featured" DESC, "updatedAt" DESC, "name");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkill_orgId_visibility_scopeId_slug_key" ON "AgentSkill"("orgId", "visibility", "scopeId", "slug");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_userId_orgId_removedAt_idx" ON "AgentSkillAdoption"("userId", "orgId", "removedAt");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_agentSkillId_idx" ON "AgentSkillAdoption"("agentSkillId");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_orgId_idx" ON "AgentSkillAdoption"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkillAdoption_orgId_userId_agentSkillId_key" ON "AgentSkillAdoption"("orgId", "userId", "agentSkillId");

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_agentSkillId_fkey" FOREIGN KEY ("agentSkillId") REFERENCES "AgentSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
