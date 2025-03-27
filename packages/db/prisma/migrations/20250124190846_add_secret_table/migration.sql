-- CreateTable
CREATE TABLE "Secret" (
    "orgId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Secret_pkey" PRIMARY KEY ("orgId","key")
);

-- AddForeignKey
ALTER TABLE "Secret" ADD CONSTRAINT "Secret_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
