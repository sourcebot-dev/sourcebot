-- CreateEnum
CREATE TYPE "HomeView" AS ENUM ('SEARCH', 'ASK');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "defaultHomeView" "HomeView";
