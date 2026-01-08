/*
  Warnings:

  - You are about to drop the `Secret` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Secret" DROP CONSTRAINT "Secret_orgId_fkey";

-- DropTable
DROP TABLE "Secret";
