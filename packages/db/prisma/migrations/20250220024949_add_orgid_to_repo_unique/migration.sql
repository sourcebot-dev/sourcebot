/*
  Warnings:

  - A unique constraint covering the columns `[external_id,external_codeHostUrl,orgId]` on the table `Repo` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Repo_external_id_external_codeHostUrl_key";

-- CreateIndex
CREATE UNIQUE INDEX "Repo_external_id_external_codeHostUrl_orgId_key" ON "Repo"("external_id", "external_codeHostUrl", "orgId");
