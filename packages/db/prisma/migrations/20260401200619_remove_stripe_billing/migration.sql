/*
  Warnings:

  - You are about to drop the column `stripeCustomerId` on the `Org` table. All the data in the column will be lost.
  - You are about to drop the column `stripeLastUpdatedAt` on the `Org` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionStatus` on the `Org` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Org" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeLastUpdatedAt",
DROP COLUMN "stripeSubscriptionStatus";

-- DropEnum
DROP TYPE "StripeSubscriptionStatus";
