-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "orgId" INTEGER NOT NULL,
    "activationCode" TEXT NOT NULL,
    "entitlements" TEXT[],
    "seats" INTEGER,
    "status" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "License_orgId_key" ON "License"("orgId");

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
