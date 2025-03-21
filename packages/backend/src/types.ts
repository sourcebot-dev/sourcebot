import { Settings as SettingsSchema } from "@sourcebot/schemas/v3/index.type";

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

/**
 * Structure of the `metadata` field in the `Repo` table.
 */
export type RepoMetadata = {
    /**
     * A set of key-value pairs that will be used as git config
     * variables when cloning the repo.
     * @see: https://git-scm.com/docs/git-clone#Documentation/git-clone.txt-code--configcodecodeltkeygtltvaluegtcode
     */
    gitConfig?: Record<string, string>;

    /**
     * A list of branches to index. Glob patterns are supported.
     */
    branches?: string[];

    /**
     * A list of tags to index. Glob patterns are supported.
     */
    tags?: string[];
}


// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };