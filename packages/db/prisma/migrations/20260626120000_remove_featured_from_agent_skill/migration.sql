-- DropIndex
DROP INDEX "AgentSkill_shared_catalog_idx";

-- AlterTable
ALTER TABLE "AgentSkill" DROP COLUMN "featured";

-- CreateIndex
CREATE INDEX "AgentSkill_shared_catalog_idx" ON "AgentSkill"("orgId", "visibility", "scopeId", "enabled", "updatedAt" DESC, "name");
