-- CreateEnum
CREATE TYPE "StripeSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "stripeLastUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "stripeSubscriptionStatus" "StripeSubscriptionStatus";
