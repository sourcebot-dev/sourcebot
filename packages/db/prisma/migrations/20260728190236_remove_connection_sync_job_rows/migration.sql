/*
  Warnings:

  - You are about to drop the `ConnectionSyncJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ConnectionSyncJob" DROP CONSTRAINT "ConnectionSyncJob_connectionId_fkey";

-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "latestSyncJobId" TEXT;

-- DropTable
DROP TABLE "ConnectionSyncJob";

-- DropEnum
DROP TYPE "ConnectionSyncJobStatus";

-- DropEnum
DROP TYPE "ConnectionSyncStatus";
