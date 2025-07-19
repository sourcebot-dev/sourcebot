/*
  Warnings:

  - You are about to drop the column `pendingApproval` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "inviteLinkEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteLinkId" TEXT,
ADD COLUMN     "memberApprovalRequired" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "pendingApproval";
