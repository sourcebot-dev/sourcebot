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
}

export interface GitRepository extends BaseRepository {
    vcs: 'git';
    cloneUrl: string;
    branches: string[];
    tags: string[];
    gitConfigMetadata?: Record<string, string>;
}

export interface LocalRepository extends BaseRepository {
    vcs: 'local';
    excludedPaths: string[];
    watch: boolean;
}

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
    fileLimitSize: number;
}

// @see : https://stackoverflow.com/a/61132308
export type DeepPartial<T> = T extends object ? {
    [P in keyof T]?: DeepPartial<T[P]>;
} : T;