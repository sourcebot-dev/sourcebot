-- CreateEnum
CREATE TYPE "PermissionSyncSource" AS ENUM ('ACCOUNT_DRIVEN', 'REPO_DRIVEN');

-- AlterTable
ALTER TABLE "AccountToRepoPermission" ADD COLUMN     "source" "PermissionSyncSource" NOT NULL DEFAULT 'ACCOUNT_DRIVEN';
