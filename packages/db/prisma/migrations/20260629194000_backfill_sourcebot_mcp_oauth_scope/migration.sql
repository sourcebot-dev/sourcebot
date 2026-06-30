ALTER TABLE "OAuthToken" ALTER COLUMN "scope" SET DEFAULT 'mcp';
ALTER TABLE "OAuthRefreshToken" ALTER COLUMN "scope" SET DEFAULT 'mcp';

UPDATE "OAuthToken"
SET "scope" = 'mcp'
WHERE "scope" = '';

UPDATE "OAuthRefreshToken"
SET "scope" = 'mcp'
WHERE "scope" = '';
