-- CreateTable
CREATE TABLE "ServicePingEvent" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePingEvent_pkey" PRIMARY KEY ("id")
);
