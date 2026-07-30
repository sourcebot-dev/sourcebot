/*
  Warnings:

  - You are about to drop the column `latestIndexingJobStatus` on the `Repo` table. All the data in the column will be lost.
  - You are about to drop the `RepoIndexingJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RepoIndexingJob" DROP CONSTRAINT "RepoIndexingJob_repoId_fkey";

-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "latestIndexingJobStatus",
ADD COLUMN     "latestIndexingJobId" TEXT;

-- DropTable
DROP TABLE "RepoIndexingJob";

-- DropEnum
DROP TYPE "RepoIndexingJobStatus";

-- DropEnum
DROP TYPE "RepoIndexingJobType";
