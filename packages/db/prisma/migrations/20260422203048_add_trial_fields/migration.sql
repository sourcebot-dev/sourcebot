-- AlterTable
ALTER TABLE "License" ADD COLUMN     "trialEnd" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "trialUsedAt" TIMESTAMP(3);
