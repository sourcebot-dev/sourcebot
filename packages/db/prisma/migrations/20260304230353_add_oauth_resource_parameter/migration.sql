-- AlterTable
ALTER TABLE "OAuthAuthorizationCode" ADD COLUMN     "resource" TEXT;

-- AlterTable
ALTER TABLE "OAuthToken" ADD COLUMN     "resource" TEXT;
