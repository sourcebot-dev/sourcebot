/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `Org` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `domain` to the `Org` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "domain" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Org_domain_key" ON "Org"("domain");
