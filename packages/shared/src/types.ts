import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";
import { z } from "zod";

export type ConfigSettings = Required<SettingsSchema>;

// Structure of the `metadata` field in the `Repo` table.
//
// @WARNING: If you modify this schema, please make sure it is backwards
// compatible with any prior versions of the schema!!
// @NOTE: If you move this schema, please update the comment in schema.prisma
// to point to the new location.
export const repoMetadataSchema = z.object({
    /**
     * A set of key-value pairs that will be used as git config
     * variables when cloning the repo.
     * @see: https://git-scm.com/docs/git-clone#Documentation/git-clone.txt-code--configcodecodeltkeygtltvaluegtcode
     */
    gitConfig: z.record(z.string(), z.string()).optional(),

    /**
     * A list of branches to index. Glob patterns are supported.
     */
    branches: z.array(z.string()).optional(),

    /**
     * A list of tags to index. Glob patterns are supported.
     */
    tags: z.array(z.string()).optional(),

    /**
     * A list of revisions that were indexed for the repo.
     */
    indexedRevisions: z.array(z.string()).optional(),
});

export type RepoMetadata = z.infer<typeof repoMetadataSchema>;

export const repoIndexingJobMetadataSchema = z.object({
    /**
     * A list of revisions that were indexed for the repo.
     */
    indexedRevisions: z.array(z.string()).optional(),
});

export type RepoIndexingJobMetadata = z.infer<typeof repoIndexingJobMetadataSchema>;

export const tenancyModeSchema = z.enum(["multi", "single"]);