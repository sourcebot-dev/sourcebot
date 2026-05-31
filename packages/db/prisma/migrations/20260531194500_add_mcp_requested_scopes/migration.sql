-- AlterTable
ALTER TABLE "McpServer" ADD COLUMN "requestedScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
