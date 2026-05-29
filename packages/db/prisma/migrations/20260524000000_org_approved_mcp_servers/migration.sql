-- Add org-approved display/tool identity to shared MCP servers.
ALTER TABLE "McpServer" ADD COLUMN "name" TEXT;
ALTER TABLE "McpServer" ADD COLUMN "sanitizedName" TEXT;

-- Backfill existing rows before enforcing non-null display identity.
UPDATE "McpServer"
SET "name" = COALESCE(
    (
        SELECT "UserMcpServer"."name"
        FROM "UserMcpServer"
        WHERE "UserMcpServer"."serverId" = "McpServer"."id"
        ORDER BY "UserMcpServer"."createdAt" ASC
        LIMIT 1
    ),
    "McpServer"."serverUrl"
);

UPDATE "McpServer"
SET "sanitizedName" = regexp_replace(lower("name"), '[^a-z0-9]', '_', 'g');

ALTER TABLE "McpServer" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "McpServer" ALTER COLUMN "sanitizedName" SET NOT NULL;

-- Remove per-user display identity now that MCP servers are org-approved.
ALTER TABLE "UserMcpServer" DROP COLUMN "name";

CREATE UNIQUE INDEX "McpServer_orgId_sanitizedName_key" ON "McpServer"("orgId", "sanitizedName");
