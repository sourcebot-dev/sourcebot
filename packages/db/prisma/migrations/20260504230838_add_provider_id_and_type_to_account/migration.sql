-- Rename `provider` to `providerId` in place; preserves every existing value.
ALTER TABLE "Account" RENAME COLUMN "provider" TO "providerId";

-- Rename the unique index to match the renamed column (no constraint gap).
ALTER INDEX "Account_provider_providerAccountId_key"
    RENAME TO "Account_providerId_providerAccountId_key";

-- Add providerType nullable, backfill from providerId, then enforce NOT NULL.
-- Pre-multi-instance, providerId (formerly `provider`) held the provider type
-- (e.g., 'github', 'gitlab'), so copying it preserves correct type semantics
-- for every existing row. New rows written via the auth adapter will set
-- providerType explicitly from a config lookup.
ALTER TABLE "Account" ADD COLUMN "providerType" TEXT;
UPDATE "Account" SET "providerType" = "providerId";
ALTER TABLE "Account" ALTER COLUMN "providerType" SET NOT NULL;
