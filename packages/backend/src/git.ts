import { CheckRepoActions, GitConfigScope, simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { mkdir } from 'node:fs/promises';
import { env } from './env.js';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

type onProgressFn = (event: SimpleGitProgressEvent) => void;

/**
 * Creates a simple-git client that has it's working directory
 * set to the given path.
 */
const createGitClientForPath = (path: string, onProgress?: onProgressFn, signal?: AbortSignal) => {
    if (!existsSync(path)) {
        throw new Error(`Path ${path} does not exist`);
    }

    const parentPath = resolve(dirname(path));

    const git = simpleGit({
        progress: onProgress,
        abort: signal,
    })
        .env({
            ...process.env,
            /**
             * @note on some inside-baseball on why this is necessary: The specific
             * issue we saw was that a `git clone` would fail without throwing, and
             * then a subsequent `git config` command would run, but since the clone
             * failed, it wouldn't be running in a git directory. Git would then walk
             * up the directory tree until it either found a git directory (in the case
             * of the development env) or it would hit a GIT_DISCOVERY_ACROSS_FILESYSTEM
             * error when trying to cross a filesystem boundary (in the prod case).
             * GIT_CEILING_DIRECTORIES ensures that this walk will be limited to the
             * parent directory.
             */
            GIT_CEILING_DIRECTORIES: parentPath,
            /**
             * Disable git credential prompts. This ensures that git operations will fail
             * immediately if credentials are not available, rather than prompting for input.
             */
            GIT_TERMINAL_PROMPT: '0',
        })
        .cwd({
            path,
        });

    return git;
}

export const cloneRepository = async (
    {
        cloneUrl,
        authHeader,
        path,
        onProgress,
        signal,
    }: {
        cloneUrl: string,
        authHeader?: string,
        path: string,
        onProgress?: onProgressFn
        signal?: AbortSignal
    }
) => {
    try {
        await mkdir(path, { recursive: true });

        const git = createGitClientForPath(path, onProgress, signal);

        const cloneArgs = [
            "--bare",
            ...(authHeader ? ["-c", `http.extraHeader=${authHeader}`] : [])
        ];

        await git.clone(cloneUrl, path, cloneArgs);

        await unsetGitConfig({
            path,
            keys: ["remote.origin.url"],
            signal,
        });
    } catch (error: unknown) {
        const baseLog = `Failed to clone repository: ${path}`;

        if (env.SOURCEBOT_LOG_LEVEL !== "debug") {
            // Avoid printing the remote URL (that may contain credentials) to logs by default.
            throw new Error(`${baseLog}. Set environment variable SOURCEBOT_LOG_LEVEL=debug to see the full error message.`);
        } else if (error instanceof Error) {
            throw new Error(`${baseLog}. Reason: ${error.message}`);
        } else {
            throw new Error(`${baseLog}. Error: ${error}`);
        }
    }
};

export const fetchRepository = async (
    {
        cloneUrl,
        authHeader,
        path,
        onProgress,
        signal,
    }: {
        cloneUrl: string,
        authHeader?: string,
        path: string,
        onProgress?: onProgressFn,
        signal?: AbortSignal
    }
) => {
    const git = createGitClientForPath(path, onProgress, signal);
    try {
        if (authHeader) {
            await git.addConfig("http.extraHeader", authHeader);
        }

        await git.fetch([
            cloneUrl,
            "+refs/heads/*:refs/heads/*",
            "--prune",
            "--progress"
        ]);
    } catch (error: unknown) {
        const baseLog = `Failed to fetch repository: ${path}`;
        if (env.SOURCEBOT_LOG_LEVEL !== "debug") {
            // Avoid printing the remote URL (that may contain credentials) to logs by default.
            throw new Error(`${baseLog}. Set environment variable SOURCEBOT_LOG_LEVEL=debug to see the full error message.`);
        } else if (error instanceof Error) {
            throw new Error(`${baseLog}. Reason: ${error.message}`);
        } else {
            throw new Error(`${baseLog}. Error: ${error}`);
        }
    } finally {
        if (authHeader) {
            await git.raw(["config", "--unset", "http.extraHeader", authHeader]);
        }
    }
}

/**
 * Applies the gitConfig to the repo at the given path. Note that this will
 * override the values for any existing keys, and append new values for keys
 * that do not exist yet. It will _not_ remove any existing keys that are not
 * present in gitConfig.
 */
export const upsertGitConfig = async (
    {
        path,
        gitConfig,
        onProgress,
        signal,
    }: {
        path: string,
        gitConfig: Record<string, string>,
        onProgress?: onProgressFn,
        signal?: AbortSignal
    }) => {
    const git = createGitClientForPath(path, onProgress, signal);

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
export const unsetGitConfig = async (
    {
        path,
        keys,
        onProgress,
        signal,
    }: {
        path: string,
        keys: string[],
        onProgress?: onProgressFn,
        signal?: AbortSignal
    }) => {
    const git = createGitClientForPath(path, onProgress, signal);

    try {
        const configList = await git.listConfig();
        const setKeys = Object.keys(configList.all);

        for (const key of keys) {
            if (setKeys.includes(key)) {
                await git.raw(['config', '--unset', key]);
            }
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
export const isPathAValidGitRepoRoot = async ({
    path,
    onProgress,
    signal,
}: {
    path: string,
    onProgress?: onProgressFn,
    signal?: AbortSignal
}) => {
    if (!existsSync(path)) {
        return false;
    }

    const git = createGitClientForPath(path, onProgress, signal);

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
    const git = createGitClientForPath(path);

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
    const git = createGitClientForPath(path);
    const branches = await git.branch();
    return branches.all;
}

export const getTags = async (path: string) => {
    const git = createGitClientForPath(path);
    const tags = await git.tags();
    return tags.all;
}

export const getCommitHashForRefName = async ({
    path,
    refName,
}: {
    path: string,
    refName: string,
}) => {
    const git = createGitClientForPath(path);

    try {
        // The `^{commit}` suffix is used to fully dereference the ref to a commit hash.
        const rev = await git.revparse(`${refName}^{commit}`);
        return rev;

        // @note: Was hitting errors when the repository is empty,
        // so we're catching the error and returning undefined.
    } catch (error: unknown) {
        console.error(error);
        return undefined;
    }
}