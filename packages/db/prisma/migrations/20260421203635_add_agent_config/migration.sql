-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('CODE_REVIEW');

-- CreateEnum
CREATE TYPE "AgentScope" AS ENUM ('ORG', 'CONNECTION', 'REPO');

-- CreateEnum
CREATE TYPE "PromptMode" AS ENUM ('REPLACE', 'APPEND');

-- CreateTable
CREATE TABLE "AgentConfig" (
    "id" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AgentType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "prompt" TEXT,
    "promptMode" "PromptMode" NOT NULL DEFAULT 'APPEND',
    "scope" "AgentScope" NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConfigToRepo" (
    "agentConfigId" TEXT NOT NULL,
    "repoId" INTEGER NOT NULL,

    CONSTRAINT "AgentConfigToRepo_pkey" PRIMARY KEY ("agentConfigId","repoId")
);

-- CreateTable
CREATE TABLE "AgentConfigToConnection" (
    "agentConfigId" TEXT NOT NULL,
    "connectionId" INTEGER NOT NULL,

    CONSTRAINT "AgentConfigToConnection_pkey" PRIMARY KEY ("agentConfigId","connectionId")
);

-- CreateIndex
CREATE INDEX "AgentConfig_orgId_type_enabled_idx" ON "AgentConfig"("orgId", "type", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConfig_orgId_name_key" ON "AgentConfig"("orgId", "name");

-- AddForeignKey
ALTER TABLE "AgentConfig" ADD CONSTRAINT "AgentConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfigToRepo" ADD CONSTRAINT "AgentConfigToRepo_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfigToRepo" ADD CONSTRAINT "AgentConfigToRepo_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfigToConnection" ADD CONSTRAINT "AgentConfigToConnection_agentConfigId_fkey" FOREIGN KEY ("agentConfigId") REFERENCES "AgentConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConfigToConnection" ADD CONSTRAINT "AgentConfigToConnection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
