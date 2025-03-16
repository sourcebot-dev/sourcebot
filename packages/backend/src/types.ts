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

    configPath: string;
}

export type Settings = {
    /**
     * The maximum size of a file (in bytes) to be indexed. Files that exceed this maximum will not be indexed.
     */
    maxFileSize: number;
    /**
     * The maximum number of trigrams per document. Files that exceed this maximum will not be indexed.
     */
    maxTrigramCount: number;
    /**
     * The interval (in milliseconds) at which the indexer should re-index all repositories.
     */
    reindexIntervalMs: number;
    /**
     * The polling rate (in milliseconds) at which the db should be checked for connections that need to be re-synced.
     */
    resyncConnectionPollingIntervalMs: number;
    /**
     * The polling rate (in milliseconds) at which the db should be checked for repos that should be re-indexed.
     */
    reindexRepoPollingIntervalMs: number;
    /**
     * The multiple of the number of CPUs to use for indexing.
     */
    indexConcurrencyMultiple: number;
    /**
     * The multiple of the number of CPUs to use for syncing the configuration.
     */
    configSyncConcurrencyMultiple: number;
    /**
     * The multiple of the number of CPUs to use for garbage collection.
     */
    gcConcurrencyMultiple: number;
    /**
     * The grace period (in milliseconds) for garbage collection. Used to prevent deleting shards while they're being loaded.
     */
    gcGracePeriodMs: number;
    /**
     * The timeout (in milliseconds) for a repo indexing to timeout.
     */
    repoIndexTimeoutMs: number;
}

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