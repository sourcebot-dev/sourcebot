-- CreateTable
CREATE TABLE "McpServerToolCallCount" (
    "mcpServerId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerToolCallCount_pkey" PRIMARY KEY ("mcpServerId","toolName")
);

-- AddForeignKey
ALTER TABLE "McpServerToolCallCount" ADD CONSTRAINT "McpServerToolCallCount_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
