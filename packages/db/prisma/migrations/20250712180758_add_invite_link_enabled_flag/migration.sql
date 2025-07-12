/*
  Warnings:

  - You are about to drop the column `inviteId` on the `Org` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Org" DROP COLUMN "inviteId",
ADD COLUMN     "inviteLinkEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "inviteLinkId" TEXT;
