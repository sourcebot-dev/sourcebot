/*
  Warnings:

  - You are about to drop the column `permissionSyncedAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `UserPermissionSyncJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserToRepoPermission` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "AccountPermissionSyncJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- DropForeignKey
ALTER TABLE "UserPermissionSyncJob" DROP CONSTRAINT "UserPermissionSyncJob_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserToRepoPermission" DROP CONSTRAINT "UserToRepoPermission_repoId_fkey";

-- DropForeignKey
ALTER TABLE "UserToRepoPermission" DROP CONSTRAINT "UserToRepoPermission_userId_fkey";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "permissionSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" DROP COLUMN "permissionSyncedAt";

-- DropTable
DROP TABLE "UserPermissionSyncJob";

-- DropTable
DROP TABLE "UserToRepoPermission";

-- DropEnum
DROP TYPE "UserPermissionSyncJobStatus";

-- CreateTable
CREATE TABLE "AccountPermissionSyncJob" (
    "id" TEXT NOT NULL,
    "status" "AccountPermissionSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "AccountPermissionSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountToRepoPermission" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repoId" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "AccountToRepoPermission_pkey" PRIMARY KEY ("repoId","accountId")
);

-- AddForeignKey
ALTER TABLE "AccountPermissionSyncJob" ADD CONSTRAINT "AccountPermissionSyncJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToRepoPermission" ADD CONSTRAINT "AccountToRepoPermission_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToRepoPermission" ADD CONSTRAINT "AccountToRepoPermission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
