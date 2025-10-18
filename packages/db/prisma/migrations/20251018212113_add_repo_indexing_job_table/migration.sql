/*
  Warnings:

  - You are about to drop the column `repoIndexingStatus` on the `Repo` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "RepoIndexingJobStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RepoIndexingJobType" AS ENUM ('INDEX', 'CLEANUP');

-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "repoIndexingStatus";

-- DropEnum
DROP TYPE "RepoIndexingStatus";

-- CreateTable
CREATE TABLE "RepoIndexingJob" (
    "id" TEXT NOT NULL,
    "type" "RepoIndexingJobType" NOT NULL,
    "status" "RepoIndexingJobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "repoId" INTEGER NOT NULL,

    CONSTRAINT "RepoIndexingJob_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RepoIndexingJob" ADD CONSTRAINT "RepoIndexingJob_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
