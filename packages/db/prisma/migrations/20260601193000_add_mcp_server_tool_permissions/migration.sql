-- CreateEnum
CREATE TYPE "McpServerToolPermission" AS ENUM ('ALLOWED', 'NEEDS_APPROVAL', 'DISABLED');

-- AlterTable
ALTER TABLE "McpServerTool" ADD COLUMN "permission" "McpServerToolPermission" NOT NULL DEFAULT 'NEEDS_APPROVAL';
