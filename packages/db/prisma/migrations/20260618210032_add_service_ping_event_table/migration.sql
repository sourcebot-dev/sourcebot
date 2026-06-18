-- CreateTable
CREATE TABLE "ServicePingEvent" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "ServicePingEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServicePingEvent" ADD CONSTRAINT "ServicePingEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
