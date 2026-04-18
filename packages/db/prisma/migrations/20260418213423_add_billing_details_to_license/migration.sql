-- AlterTable
ALTER TABLE "License" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "interval" TEXT,
ADD COLUMN     "intervalCount" INTEGER,
ADD COLUMN     "nextRenewalAmount" INTEGER,
ADD COLUMN     "nextRenewalAt" TIMESTAMP(3),
ADD COLUMN     "planName" TEXT,
ADD COLUMN     "unitAmount" INTEGER;
