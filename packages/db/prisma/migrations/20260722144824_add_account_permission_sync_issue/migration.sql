-- CreateEnum
CREATE TYPE "AccountPermissionSyncIssue" AS ENUM ('REAUTHENTICATION_REQUIRED', 'INSUFFICIENT_SCOPE');

-- AlterTable
ALTER TABLE "Account"
ADD COLUMN "permissionSyncIssue" "AccountPermissionSyncIssue",
ADD COLUMN "permissionSyncIssueAt" TIMESTAMP(3);
