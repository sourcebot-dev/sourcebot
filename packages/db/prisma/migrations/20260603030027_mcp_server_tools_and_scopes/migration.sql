/*
  Warnings:

  - You are about to drop the `McpServerToolCallCount` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "McpServerToolPermission" AS ENUM ('ALLOWED', 'NEEDS_APPROVAL', 'DISABLED');

-- DropForeignKey
ALTER TABLE "McpServerToolCallCount" DROP CONSTRAINT "McpServerToolCallCount_mcpServerId_fkey";

-- DropTable
DROP TABLE "McpServerToolCallCount";

-- CreateTable
CREATE TABLE "McpServerScope" (
    "mcpServerId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerScope_pkey" PRIMARY KEY ("mcpServerId","scope")
);

-- CreateTable
CREATE TABLE "McpServerTool" (
    "mcpServerId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "permission" "McpServerToolPermission" NOT NULL DEFAULT 'NEEDS_APPROVAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerTool_pkey" PRIMARY KEY ("mcpServerId","toolName")
);

-- AddForeignKey
ALTER TABLE "McpServerScope" ADD CONSTRAINT "McpServerScope_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServerTool" ADD CONSTRAINT "McpServerTool_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
