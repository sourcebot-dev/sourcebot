-- CreateTable
CREATE TABLE "SearchContext" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orgId" INTEGER NOT NULL,

    CONSTRAINT "SearchContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RepoToSearchContext" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_RepoToSearchContext_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "SearchContext_name_orgId_key" ON "SearchContext"("name", "orgId");

-- CreateIndex
CREATE INDEX "_RepoToSearchContext_B_index" ON "_RepoToSearchContext"("B");

-- AddForeignKey
ALTER TABLE "SearchContext" ADD CONSTRAINT "SearchContext_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RepoToSearchContext" ADD CONSTRAINT "_RepoToSearchContext_A_fkey" FOREIGN KEY ("A") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RepoToSearchContext" ADD CONSTRAINT "_RepoToSearchContext_B_fkey" FOREIGN KEY ("B") REFERENCES "SearchContext"("id") ON DELETE CASCADE ON UPDATE CASCADE;
