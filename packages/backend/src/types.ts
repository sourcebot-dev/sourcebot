import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";
import { z } from "zod";

export type AppContext = {
    /**
     * Path to the repos cache directory.
     */
    reposPath: string;

    /**
     * Path to the index cache directory;
     */
    indexPath: string;

    cachePath: string;
}

export type Settings = Required<SettingsSchema>;

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
});

export type RepoMetadata = z.infer<typeof repoMetadataSchema>;

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };