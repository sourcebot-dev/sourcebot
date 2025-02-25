/**
 * @deprecated in V3
 */
interface BaseRepository {
    vcs: 'git' | 'local';
    id: string;
    name: string;
    path: string;
    isStale: boolean;
    lastIndexedDate?: string;
    isFork?: boolean;
    isArchived?: boolean;
    codeHost?: string;
    topics?: string[];
    sizeInBytes?: number;
    tenantId?: number;
}

/**
 * @deprecated in V3
 */
export interface GitRepository extends BaseRepository {
    vcs: 'git';
    cloneUrl: string;
    branches: string[];
    tags: string[];
    gitConfigMetadata?: Record<string, string>;
}

/**
 * @deprecated in V3
 */
export interface LocalRepository extends BaseRepository {
    vcs: 'local';
    excludedPaths: string[];
    watch: boolean;
}

/**
 * @deprecated in V3
 */
export type Repository = GitRepository | LocalRepository;

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
     * The maximum size of a file (in bytes) to be indexed. Files that exceed this maximum will not be inexed.
     */
    maxFileSize: number;
    /**
     * Automatically delete stale repositories from the index. Defaults to true.
     */
    autoDeleteStaleRepos: boolean;
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
}

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;

// @see: https://stackoverflow.com/a/69328045
export type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };