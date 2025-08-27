-- CreateTable
CREATE TABLE "UserToRepoPermission" (
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repoId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserToRepoPermission_pkey" PRIMARY KEY ("repoId","userId")
);

-- AddForeignKey
ALTER TABLE "UserToRepoPermission" ADD CONSTRAINT "UserToRepoPermission_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserToRepoPermission" ADD CONSTRAINT "UserToRepoPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
