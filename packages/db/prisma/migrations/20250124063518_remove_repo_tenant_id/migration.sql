/*
  Warnings:

  - You are about to drop the column `tenantId` on the `Repo` table. All the data in the column will be lost.
  - Made the column `orgId` on table `Repo` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Repo" DROP COLUMN "tenantId",
ALTER COLUMN "orgId" SET NOT NULL;
