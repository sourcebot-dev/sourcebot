-- Installs the pgcrypto extension. Required for the gen_random_uuid() function.
-- @see: https://www.prisma.io/docs/orm/prisma-migrate/workflows/native-database-functions#how-to-install-a-postgresql-extension-as-part-of-a-migration
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure single tenant organization exists
INSERT INTO "Org" (id, name, domain, "inviteLinkId", "createdAt", "updatedAt")
VALUES (1, 'default', '~', gen_random_uuid(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Backfill inviteLinkId for any existing orgs that don't have one
UPDATE "Org"
SET "inviteLinkId" = gen_random_uuid()
WHERE "inviteLinkId" IS NULL;