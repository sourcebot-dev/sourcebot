-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserToOrg" (
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',

    PRIMARY KEY ("orgId", "userId"),
    CONSTRAINT "UserToOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserToOrg_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserToOrg" ("joinedAt", "orgId", "userId") SELECT "joinedAt", "orgId", "userId" FROM "UserToOrg";
DROP TABLE "UserToOrg";
ALTER TABLE "new_UserToOrg" RENAME TO "UserToOrg";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
