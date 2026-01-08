/*
  Migrates the `connectionType` column from text to a enum. The values in this field are known to
  be one of the following: github, gitlab, gitea, gerrit, bitbucket, azuredevops, git.

  This is occording to what we would expect to be in a valid config file for the schema version at commit 4899c9fbc755851af2ddcce99f4a4200f2faa4f6.
  See: https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/schemas/src/v3/connection.type.ts#L3
*/
-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('github', 'gitlab', 'gitea', 'gerrit', 'bitbucket', 'azuredevops', 'git');

-- AlterTable - Convert existing column to enum type without dropping data
ALTER TABLE "Connection" 
  ALTER COLUMN "connectionType" TYPE "ConnectionType" 
  USING "connectionType"::text::"ConnectionType";
