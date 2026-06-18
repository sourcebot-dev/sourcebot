-- Add per-user org skill opt-out state. A null value means the adoption is active;
-- a non-null value means the user removed the skill from their own command list.
ALTER TABLE "AgentSkillAdoption" ADD COLUMN "removedAt" TIMESTAMP(3);

DROP INDEX "AgentSkillAdoption_userId_orgId_idx";

CREATE INDEX "AgentSkillAdoption_userId_orgId_removedAt_idx" ON "AgentSkillAdoption"("userId", "orgId", "removedAt");
