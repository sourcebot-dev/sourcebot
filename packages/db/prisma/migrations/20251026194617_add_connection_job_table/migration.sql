/*
  Warnings:

  - You are about to drop the column `syncStatus` on the `Connection` table. All the data in the column will be lost.
  - You are about to drop the column `syncStatusMetadata` on the `Connection` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ConnectionSyncJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Connection" DROP COLUMN "syncStatus",
DROP COLUMN "syncStatusMetadata";

-- CreateTable
CREATE TABLE "ConnectionSyncJob" (
    "id" TEXT NOT NULL,
    "status" "ConnectionSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "warningMessages" TEXT[],
    "errorMessage" TEXT,
    "connectionId" INTEGER NOT NULL,

    CONSTRAINT "ConnectionSyncJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConnectionSyncJob" ADD CONSTRAINT "ConnectionSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
