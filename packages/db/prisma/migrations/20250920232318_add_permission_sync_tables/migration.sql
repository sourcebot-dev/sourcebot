-- CreateEnum
CREATE TYPE "RepoPermissionSyncJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "UserPermissionSyncJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "permissionSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "permissionSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RepoPermissionSyncJob" (
    "id" TEXT NOT NULL,
    "status" "RepoPermissionSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "repoId" INTEGER NOT NULL,

    CONSTRAINT "RepoPermissionSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionSyncJob" (
    "id" TEXT NOT NULL,
    "status" "UserPermissionSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserPermissionSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserToRepoPermission" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repoId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserToRepoPermission_pkey" PRIMARY KEY ("repoId","userId")
);

-- AddForeignKey
ALTER TABLE "RepoPermissionSyncJob" ADD CONSTRAINT "RepoPermissionSyncJob_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionSyncJob" ADD CONSTRAINT "UserPermissionSyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToRepoPermission" ADD CONSTRAINT "UserToRepoPermission_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToRepoPermission" ADD CONSTRAINT "UserToRepoPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
