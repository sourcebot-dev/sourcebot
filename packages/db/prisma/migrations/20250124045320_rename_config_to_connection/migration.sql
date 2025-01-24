/*
  Warnings:

  - You are about to drop the `Config` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ConnectionSyncStatus" AS ENUM ('SYNC_NEEDED', 'IN_SYNC_QUEUE', 'SYNCING', 'SYNCED', 'FAILED');

-- DropForeignKey
ALTER TABLE "Config" DROP CONSTRAINT "Config_orgId_fkey";

-- DropTable
DROP TABLE "Config";

-- DropEnum
DROP TYPE "ConfigSyncStatus";

-- CreateTable
CREATE TABLE "Connection" (
    "id" SERIAL NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3),
    "syncStatus" "ConnectionSyncStatus" NOT NULL DEFAULT 'SYNC_NEEDED',
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;
