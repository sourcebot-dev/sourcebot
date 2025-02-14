-- AlterTable
ALTER TABLE "User" ADD COLUMN     "encryptedPassword" TEXT,
ADD COLUMN     "iv" TEXT;
