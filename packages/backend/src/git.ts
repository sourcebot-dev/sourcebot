import { simpleGit, SimpleGitProgressEvent } from 'simple-git';

export const cloneRepository = async (cloneURL: string, path: string, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });
    try {
        await git.clone(
            cloneURL,
            path,
            [
                "--bare",
            ]
        );

        await git.cwd({
            path,
        }).addConfig("remote.origin.fetch", "+refs/heads/*:refs/heads/*");
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to clone repository: ${error.message}`);
        } else {
            throw new Error(`Failed to clone repository: ${error}`);
        }
    }
}


export const fetchRepository = async (path: string, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    try {
        await git.cwd({
            path: path,
        }).fetch(
            "origin",
            [
                "--prune",
                "--progress"
            ]
        );
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
export const upsertGitConfig = async (path: string, gitConfig: Record<string, string>, onProgress?: (event: SimpleGitProgressEvent) => void) => {
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