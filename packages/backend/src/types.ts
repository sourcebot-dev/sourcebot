
export type Operation = {
    type: 'clone',
    status: 'running' | 'completed' | 'failed',
    progress: number,
    repoId: string;
    startedAtDate: string;
    message?: string;
}

export type Repository = {
    /**
     * Name of the repository (e.g., 'sourcebot-dev/sourcebot')
     */
    name: string;

    /**
     * The unique identifier for the repository. (e.g., `github.com/sourcebot-dev/sourcebot`)
     */
    id: string;
    
    /**
     * The .git url for the repository
     */
    cloneUrl: string;

    /**
     * Path to where the repository is cloned
     */
    path: string;

    gitConfigMetadata?: Record<string, string>;

    lastIndexedDate?: string;

    isStale: boolean;
    isFork: boolean;
    isArchived: boolean;
}

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
