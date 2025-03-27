-- CreateTable
CREATE TABLE "RepoToConnection" (
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectionId" INTEGER NOT NULL,
    "repoId" INTEGER NOT NULL,

    CONSTRAINT "RepoToConnection_pkey" PRIMARY KEY ("connectionId","repoId")
);

-- AddForeignKey
ALTER TABLE "RepoToConnection" ADD CONSTRAINT "RepoToConnection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepoToConnection" ADD CONSTRAINT "RepoToConnection_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
