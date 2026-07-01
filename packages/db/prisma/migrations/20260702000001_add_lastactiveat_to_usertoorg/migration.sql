-- AlterTable
ALTER TABLE "UserToOrg" ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- Backfill per-membership activity from the global User.lastActiveAt. In a
-- single-tenant deployment a user belongs to exactly one org, so the global
-- timestamp is exactly the per-org timestamp. In multi-tenant deployments this
-- seeds every membership with the user's global last-active time as the best
-- available signal; the per-org value diverges naturally from the next
-- authenticated action onward. Without this, every existing membership would
-- read as "never active" (NULL) until each member's next request.
UPDATE "UserToOrg" AS uto
SET "lastActiveAt" = u."lastActiveAt"
FROM "User" AS u
WHERE uto."userId" = u."id"
  AND u."lastActiveAt" IS NOT NULL;
