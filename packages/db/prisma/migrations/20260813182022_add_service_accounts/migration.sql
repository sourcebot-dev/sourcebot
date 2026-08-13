-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('HUMAN', 'SERVICE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "type" "UserType" NOT NULL DEFAULT 'HUMAN';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
