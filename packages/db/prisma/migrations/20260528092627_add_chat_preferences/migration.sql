-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chatCustomInstructions" TEXT,
ADD COLUMN     "chatPreferences" JSONB NOT NULL DEFAULT '{}';
