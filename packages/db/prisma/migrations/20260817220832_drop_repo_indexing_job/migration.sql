-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "latestIndexingJobStatus";

-- DropTable
DROP TABLE "RepoIndexingJob";

-- DropEnum
DROP TYPE "RepoIndexingJobStatus";

-- DropEnum
DROP TYPE "RepoIndexingJobType";
