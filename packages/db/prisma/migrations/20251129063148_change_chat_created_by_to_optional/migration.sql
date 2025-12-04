-- First, remove the NOT NULL constraint on the createdById column.
ALTER TABLE "Chat" ALTER COLUMN "createdById" DROP NOT NULL;

-- Then, set all chats created by the guest user (id: 1) to have a NULL createdById.
UPDATE "Chat" SET "createdById" = NULL WHERE "createdById" = '1';
