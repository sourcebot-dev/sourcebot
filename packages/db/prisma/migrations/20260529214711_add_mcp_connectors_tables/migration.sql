-- CreateEnum
CREATE TYPE "McpServerClientInfoSource" AS ENUM ('DYNAMIC', 'STATIC');

-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sanitizedName" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "clientInfo" TEXT,
    "clientInfoSource" "McpServerClientInfoSource" NOT NULL DEFAULT 'DYNAMIC',
    "orgId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpServerToolCallCount" (
    "mcpServerId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerToolCallCount_pkey" PRIMARY KEY ("mcpServerId","toolName")
);

-- CreateTable
CREATE TABLE "UserMcpServer" (
    "userId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "tokens" TEXT,
    "tokensExpiresAt" TIMESTAMP(3),
    "codeVerifier" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserMcpServer_pkey" PRIMARY KEY ("userId","serverId")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_serverUrl_orgId_key" ON "McpServer"("serverUrl", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_orgId_sanitizedName_key" ON "McpServer"("orgId", "sanitizedName");

-- CreateIndex
CREATE INDEX "UserMcpServer_serverId_idx" ON "UserMcpServer"("serverId");

-- CreateIndex
CREATE INDEX "UserMcpServer_state_idx" ON "UserMcpServer"("state");

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServerToolCallCount" ADD CONSTRAINT "McpServerToolCallCount_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
