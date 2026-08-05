-- Make `User.email` required (NOT NULL).
--
-- This migration runs automatically on startup (`prisma migrate deploy`), so it must
-- never fail on existing data. Some instances have legacy `User` rows with a NULL
-- email — most commonly OAuth/OIDC accounts created from an identity-provider profile
-- that returned no email. A bare `SET NOT NULL` would error on those rows and brick the
-- upgrade, so we first backfill any NULL email with a deterministic, unique, obviously
-- synthetic placeholder (the `.invalid` TLD is reserved and can never be a real address;
-- keying off the row `id` guarantees uniqueness under the existing unique constraint).
--
-- Going forward, the `signIn` callback in `packages/web/src/auth.ts` rejects OAuth/OIDC
-- sign-ins whose profile has no email, so no new NULL/placeholder rows are created.
-- Operators can identify backfilled accounts with:
--   SELECT id, email FROM "User" WHERE email LIKE 'placeholder-%@no-email.invalid';
UPDATE "User"
SET "email" = 'placeholder-' || "id" || '@no-email.invalid'
WHERE "email" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;
