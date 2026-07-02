-- AlterTable
ALTER TABLE "AgentSkill" ADD COLUMN     "sourceBlobSha" TEXT,
ADD COLUMN     "sourceFilePath" TEXT,
ADD COLUMN     "sourceImportedAt" TIMESTAMP(3),
ADD COLUMN     "sourceRepoName" TEXT,
ADD COLUMN     "sourceRevision" TEXT;
