/*
  Warnings:

  - Added the required column `tenantId` to the `Repo` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Repo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexedAt" DATETIME,
    "isFork" BOOLEAN NOT NULL,
    "isArchived" BOOLEAN NOT NULL,
    "metadata" JSONB NOT NULL,
    "cloneUrl" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_codeHostType" TEXT NOT NULL,
    "external_codeHostUrl" TEXT NOT NULL
);
INSERT INTO "new_Repo" ("cloneUrl", "createdAt", "external_codeHostType", "external_codeHostUrl", "external_id", "id", "indexedAt", "isArchived", "isFork", "metadata", "name", "updatedAt") SELECT "cloneUrl", "createdAt", "external_codeHostType", "external_codeHostUrl", "external_id", "id", "indexedAt", "isArchived", "isFork", "metadata", "name", "updatedAt" FROM "Repo";
DROP TABLE "Repo";
ALTER TABLE "new_Repo" RENAME TO "Repo";
CREATE UNIQUE INDEX "Repo_external_id_external_codeHostUrl_key" ON "Repo"("external_id", "external_codeHostUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
