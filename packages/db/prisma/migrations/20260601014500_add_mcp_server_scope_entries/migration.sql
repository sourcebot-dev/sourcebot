-- CreateTable
CREATE TABLE "McpServerScope" (
    "mcpServerId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerScope_pkey" PRIMARY KEY ("mcpServerId","scope")
);

-- Backfill existing requested scopes as enabled scope entries.
INSERT INTO "McpServerScope" ("mcpServerId", "scope", "enabled", "createdAt", "updatedAt")
SELECT DISTINCT "id", btrim(scope), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "McpServer"
CROSS JOIN LATERAL unnest("requestedScopes") AS scope
WHERE btrim(scope) <> '';

-- AddForeignKey
ALTER TABLE "McpServerScope" ADD CONSTRAINT "McpServerScope_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "McpServer" DROP COLUMN "requestedScopes";
