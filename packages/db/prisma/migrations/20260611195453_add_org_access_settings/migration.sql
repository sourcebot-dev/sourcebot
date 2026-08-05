-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "isAnonymousAccessEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCredentialsLoginEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isEmailCodeLoginEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill the new dedicated column from the legacy `metadata.anonymousAccessEnabled`
-- value (see orgMetadataSchema in packages/web/src/types.ts) so existing deployments
-- that had anonymous access enabled keep it after upgrading.
UPDATE "Org"
SET "isAnonymousAccessEnabled" = true
WHERE "metadata"->>'anonymousAccessEnabled' = 'true';
