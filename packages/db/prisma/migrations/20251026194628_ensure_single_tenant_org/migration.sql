-- Ensure single tenant organization exists
INSERT INTO "Org" (id, name, domain, "inviteLinkId", "createdAt", "updatedAt")
VALUES (1, 'default', '~', gen_random_uuid(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Backfill inviteLinkId for any existing orgs that don't have one
UPDATE "Org"
SET "inviteLinkId" = gen_random_uuid()
WHERE "inviteLinkId" IS NULL;