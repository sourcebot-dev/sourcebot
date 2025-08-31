import { CheckRepoActions, GitConfigScope, simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { mkdir } from 'node:fs/promises';

type onProgressFn = (event: SimpleGitProgressEvent) => void;

export const cloneRepository = async (
    remoteUrl: URL,
    path: string,
    onProgress?: onProgressFn
) => {
    try {
        await mkdir(path, { recursive: true });

        const git = simpleGit({
            progress: onProgress,
        }).cwd({
            path,
        })

        await git.init(/*bare = */ true);

        await git.fetch([
            remoteUrl.toString(),
            // See https://git-scm.com/book/en/v2/Git-Internals-The-Refspec
            "+refs/heads/*:refs/heads/*",
            "--progress",
        ]);
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        } else {
            throw new Error(`Failed to clone repository: ${error}`);
        }
    }
};

export const fetchRepository = async (
    remoteUrl: URL,
    path: string,
    onProgress?: onProgressFn
) => {
    try {
        const git = simpleGit({
            progress: onProgress,
        }).cwd({
            path: path,
        })

        await git.fetch([
            remoteUrl.toString(),
            "+refs/heads/*:refs/heads/*",
            "--prune",
            "--progress"
        ]);
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch repository ${path}: ${error.message}`);
        } else {
            throw new Error(`Failed to fetch repository ${path}: ${error}`);
        }
    }
}

/**
 * Applies the gitConfig to the repo at the given path. Note that this will
 * override the values for any existing keys, and append new values for keys
 * that do not exist yet. It will _not_ remove any existing keys that are not
 * present in gitConfig.
 */
export const upsertGitConfig = async (path: string, gitConfig: Record<string, string>, onProgress?: onProgressFn) => {
    const git = simpleGit({
        progress: onProgress,
    }).cwd(path);

    try {
        for (const [key, value] of Object.entries(gitConfig)) {
            await git.addConfig(key, value);
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to set git config ${path}: ${error.message}`);
        } else {
            throw new Error(`Failed to set git config ${path}: ${error}`);
        }
    }
}

/**
 * Unsets the specified keys in the git config for the repo at the given path.
 * If a key is not set, this is a no-op.
 */
export const unsetGitConfig = async (path: string, keys: string[], onProgress?: onProgressFn) => {
    const git = simpleGit({
        progress: onProgress,
    }).cwd(path);

    try {
        for (const key of keys) {
            await git.raw(['config', '--unset', key]);
        }
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to unset git config ${path}: ${error.message}`);
        } else {
            throw new Error(`Failed to unset git config ${path}: ${error}`);
        }
    }
}

/**
 * Returns true if `path` is the _root_ of a git repository.
 */
export const isPathAValidGitRepoRoot = async (path: string, onProgress?: onProgressFn) => {
    const git = simpleGit({
        progress: onProgress,
    }).cwd(path);

    try {
        return git.checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`isPathAGitRepoRoot failed: ${error.message}`);
        } else {
            throw new Error(`isPathAGitRepoRoot failed: ${error}`);
        }
    }
}

export const isUrlAValidGitRepo = async (url: string) => {
    const git = simpleGit();

    // List the remote heads. If an exception is thrown, the URL is not a valid git repo.
    try {
        const result = await git.listRemote(['--heads', url]);
        return result.trim().length > 0;
    } catch (error: unknown) {
        return false;
    }
}

export const getOriginUrl = async (path: string) => {
    const git = simpleGit().cwd(path);

    try {
        const remotes = await git.getConfig('remote.origin.url', GitConfigScope.local);
        return remotes.value;
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to get origin for ${path}: ${error.message}`);
        } else {
            throw new Error(`Failed to get origin for ${path}: ${error}`);
        }
    }
}

export const getBranches = async (path: string) => {
    const git = simpleGit();
    const branches = await git.cwd({
        path,
    }).branch();

    return branches.all;
}

export const getTags = async (path: string) => {
    const git = simpleGit();
    const tags = await git.cwd({
        path,
    }).tags();
    return tags.all;
}