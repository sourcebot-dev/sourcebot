/*
  Warnings:

  - You are about to drop the column `name` on the `McpServer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "McpServer" DROP COLUMN "name";

-- CreateTable
CREATE TABLE "UserMcpServer" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMcpServer_pkey" PRIMARY KEY ("userId","serverId")
);

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
