-- Set all chats created by the guest user (id: 1) to have a NULL createdById.
UPDATE "Chat" SET "createdById" = NULL WHERE "createdById" = '1';

-- AlterTable
ALTER TABLE "Chat" ALTER COLUMN "createdById" DROP NOT NULL;
