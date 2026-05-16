/*
  Warnings:

  - The values [GUEST] on the enum `OrgRole` will be removed. If these variants are still used in the database, this will fail.

*/

-- Remove the guest user and its membership (only holder of GUEST role)
DELETE FROM "UserToOrg" WHERE "role" = 'GUEST';
DELETE FROM "User" WHERE id = '1';

-- AlterEnum
BEGIN;
CREATE TYPE "OrgRole_new" AS ENUM ('OWNER', 'MEMBER');
ALTER TABLE "UserToOrg" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "UserToOrg" ALTER COLUMN "role" TYPE "OrgRole_new" USING ("role"::text::"OrgRole_new");
ALTER TYPE "OrgRole" RENAME TO "OrgRole_old";
ALTER TYPE "OrgRole_new" RENAME TO "OrgRole";
DROP TYPE "OrgRole_old";
ALTER TABLE "UserToOrg" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
COMMIT;
