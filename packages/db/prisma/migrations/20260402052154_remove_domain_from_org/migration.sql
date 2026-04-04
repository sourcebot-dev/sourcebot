/*
  Warnings:

  - You are about to drop the column `domain` on the `Org` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Org_domain_key";

-- AlterTable
ALTER TABLE "Org" DROP COLUMN "domain";
