-- CreateEnum
CREATE TYPE "McpServerClientInfoSource" AS ENUM ('DYNAMIC', 'STATIC');

-- CreateEnum
CREATE TYPE "McpServerToolPermission" AS ENUM ('ALLOWED', 'NEEDS_APPROVAL', 'DISABLED');

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
CREATE TABLE "McpServerOAuthScope" (
    "mcpServerId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerOAuthScope_pkey" PRIMARY KEY ("mcpServerId","scope")
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
ALTER TABLE "McpServerOAuthScope" ADD CONSTRAINT "McpServerOAuthScope_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpServerTool" ADD CONSTRAINT "McpServerTool_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMcpServer" ADD CONSTRAINT "UserMcpServer_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
