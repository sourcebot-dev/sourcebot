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
    "repoIndexingStatus" TEXT NOT NULL DEFAULT 'NEW',
    "external_id" TEXT NOT NULL,
    "external_codeHostType" TEXT NOT NULL,
    "external_codeHostUrl" TEXT NOT NULL,
    "orgId" INTEGER,
    CONSTRAINT "Repo_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Repo" ("cloneUrl", "createdAt", "external_codeHostType", "external_codeHostUrl", "external_id", "id", "indexedAt", "isArchived", "isFork", "metadata", "name", "repoIndexingStatus", "tenantId", "updatedAt") SELECT "cloneUrl", "createdAt", "external_codeHostType", "external_codeHostUrl", "external_id", "id", "indexedAt", "isArchived", "isFork", "metadata", "name", "repoIndexingStatus", "tenantId", "updatedAt" FROM "Repo";
DROP TABLE "Repo";
ALTER TABLE "new_Repo" RENAME TO "Repo";
CREATE UNIQUE INDEX "Repo_external_id_external_codeHostUrl_key" ON "Repo"("external_id", "external_codeHostUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
