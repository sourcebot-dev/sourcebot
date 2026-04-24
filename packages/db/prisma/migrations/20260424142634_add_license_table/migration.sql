-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "trialUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "activationCode" TEXT NOT NULL,
    "entitlements" TEXT[],
    "seats" INTEGER,
    "status" TEXT,
    "planName" TEXT,
    "unitAmount" INTEGER,
    "currency" TEXT,
    "interval" TEXT,
    "intervalCount" INTEGER,
    "nextRenewalAt" TIMESTAMP(3),
    "nextRenewalAmount" INTEGER,
    "cancelAt" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "hasPaymentMethod" BOOLEAN,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_orgId_key" ON "License"("orgId");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
