-- CreateEnum
CREATE TYPE "RepoPermissionSyncStatus" AS ENUM ('SYNC_NEEDED', 'IN_SYNC_QUEUE', 'SYNCING', 'SYNCED', 'FAILED');

-- AlterTable
ALTER TABLE "Repo" ADD COLUMN     "permissionSyncJobLastCompletedAt" TIMESTAMP(3),
ADD COLUMN     "permissionSyncStatus" "RepoPermissionSyncStatus" NOT NULL DEFAULT 'SYNC_NEEDED';
