-- Track whether McpServer.clientInfo came from dynamic client registration or admin-provided static credentials.
CREATE TYPE "McpServerClientInfoSource" AS ENUM ('DYNAMIC', 'STATIC');

ALTER TABLE "McpServer"
ADD COLUMN "clientInfoSource" "McpServerClientInfoSource" NOT NULL DEFAULT 'DYNAMIC';
