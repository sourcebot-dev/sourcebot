/*
  Migrates the `external_codeHostType` column from text to a enum. The values in this field are known to
  be one of the following: github, gitlab, gitea, gerrit, bitbucket-server, bitbucket-cloud, generic-git-host, azuredevops.

  This is occording to what we would expect to be in the database written as of commit 4899c9fbc755851af2ddcce99f4a4200f2faa4f6.
  See:
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L57
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L135
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L208
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L291
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L407
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L510
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L574
    - https://github.com/sourcebot-dev/sourcebot/blob/4899c9fbc755851af2ddcce99f4a4200f2faa4f6/packages/backend/src/repoCompileUtils.ts#L642
*/
-- CreateEnum
CREATE TYPE "CodeHostType" AS ENUM ('github', 'gitlab', 'gitea', 'gerrit', 'bitbucket-server', 'bitbucket-cloud', 'generic-git-host', 'azuredevops');

-- AlterTable - Convert existing column to enum type without dropping data
ALTER TABLE "Repo" 
  ALTER COLUMN "external_codeHostType" TYPE "CodeHostType" 
  USING "external_codeHostType"::text::"CodeHostType";
