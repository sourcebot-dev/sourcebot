-- AlterTable
ALTER TABLE "AgentSkill" ADD COLUMN "autoEnrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "updatedById" TEXT;

-- CreateTable
CREATE TABLE "AgentSkillAdoption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "agentSkillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSkillAdoption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentSkillAdoption_orgId_userId_agentSkillId_key" ON "AgentSkillAdoption"("orgId", "userId", "agentSkillId");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_userId_orgId_idx" ON "AgentSkillAdoption"("userId", "orgId");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_agentSkillId_idx" ON "AgentSkillAdoption"("agentSkillId");

-- CreateIndex
CREATE INDEX "AgentSkillAdoption_orgId_idx" ON "AgentSkillAdoption"("orgId");

-- CreateIndex
CREATE INDEX "AgentSkill_updatedById_idx" ON "AgentSkill"("updatedById");

-- CreateIndex
CREATE INDEX "AgentSkill_org_catalog_idx" ON "AgentSkill"("orgId", "visibility", "scopeId", "enabled", "featured" DESC, "updatedAt" DESC, "name");

-- CreateIndex
CREATE INDEX "AgentSkill_org_commands_idx" ON "AgentSkill"("orgId", "visibility", "scopeId", "enabled", "autoEnrolled", "updatedAt" DESC, "name");

-- AddForeignKey
ALTER TABLE "AgentSkill" ADD CONSTRAINT "AgentSkill_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSkillAdoption" ADD CONSTRAINT "AgentSkillAdoption_agentSkillId_fkey" FOREIGN KEY ("agentSkillId") REFERENCES "AgentSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
