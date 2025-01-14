-- CreateTable
CREATE TABLE "Repo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "indexedAt" DATETIME,
    "isFork" BOOLEAN NOT NULL,
    "isArchived" BOOLEAN NOT NULL,
    "metadata" JSONB NOT NULL,
    "cloneUrl" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_codeHostType" TEXT NOT NULL,
    "external_codeHostUrl" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Repo_external_id_external_codeHostUrl_key" ON "Repo"("external_id", "external_codeHostUrl");
