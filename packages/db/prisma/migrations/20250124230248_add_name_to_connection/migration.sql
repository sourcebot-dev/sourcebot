/*
  Warnings:

  - Added the required column `name` to the `Connection` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "name" TEXT NOT NULL;
