/*
  Warnings:

  - A unique constraint covering the columns `[name,orgId]` on the table `Connection` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Connection_name_orgId_key" ON "Connection"("name", "orgId");
