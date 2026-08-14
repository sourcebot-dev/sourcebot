import { createLogger } from "@sourcebot/shared";
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CheckRepoActions, GitConfigScope, simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { parseEnv } from '@simple-git/argv-parser';
import { withGitCredentialSession } from './gitCredentialSession.js';
import type { GitHttpCredentials } from './types.js';

type onProgressFn = (event: SimpleGitProgressEvent) => void;

const logger = createLogger('git-utils');

/**
 * simple-git blocks certain env vars (e.g., GIT_SSH_COMMAND, GIT_ASKPASS, etc.)
 * by default to prevent common git vulnerabilities by throwing a exception. To
 * maintain backwards compatibility, we opt to permit these env vars but raise a
 * warning message s.t., system admins are aware.
 * 
 * @see https://github.com/steveukx/git-js/blob/main/docs/PLUGIN-UNSAFE-ACTIONS.md
 */
const { vulnerabilities: envVulnerabilities } = parseEnv(process.env);
const unsafe = Object.fromEntries(
    envVulnerabilities.map(v => [v.category, true] as const)
);

if (envVulnerabilities.length > 0) {
    const details = envVulnerabilities.map(v => `  - ${v.category}: ${v.message}`).join('\n');
    logger.warn(
        `Opting in to unsafe simple-git categories based on inherited environment:\n${details}\n` +
        `See https://github.com/steveukx/git-js/blob/main/docs/PLUGIN-UNSAFE-ACTIONS.md`
    );
}

/**
 * Creates a simple-git client that has it's working directory
 * set to the given path.
 */
const createGitClientForPath = (
    path: string,
    onProgress?: onProgressFn,
    signal?: AbortSignal,
    environment: NodeJS.ProcessEnv = {},
    additionalUnsafe: typeof unsafe = {},
) => {
    if (!existsSync(path)) {
        throw new Error(`Path ${path} does not exist`);
    }

    const parentPath = resolve(dirname(path));
    const git = simpleGit({
        progress: onProgress,
        abort: signal,
        unsafe: {
            ...unsafe,
            ...additionalUnsafe,
        },
    })
        .env({
            ...process.env,
            ...environment,
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

/**
 * Runs a remote Git operation with a client scoped to an isolated credential session.
 */
const withRemoteGitClient = async <T>({
    path,
    cloneUrl,
    credentials,
    onProgress,
    signal,
    operation,
}: {
    path: string;
    cloneUrl: string;
    credentials?: GitHttpCredentials;
    onProgress?: onProgressFn;
    signal?: AbortSignal;
    operation: (git: ReturnType<typeof createGitClientForPath>) => Promise<T>;
}): Promise<T> => withGitCredentialSession({
    cloneUrl,
    credentials,
    signal,
    operation: async (environment) => {
        const credentialSessionUnsafe: typeof unsafe = credentials === undefined
            ? {}
            : {
                allowUnsafeConfigEnvCount: true,
                allowUnsafeCredentialHelper: true,
                allowUnsafeAskPass: true,
            };
        const git = createGitClientForPath(
            path,
            onProgress,
            signal,
            environment,
            credentialSessionUnsafe,
        );
        return operation(git);
    },
});

export const cloneRepository = async (
    {
        cloneUrl,
        credentials,
        path,
        onProgress,
        signal,
    }: {
        cloneUrl: string,
        credentials?: GitHttpCredentials,
        path: string,
        onProgress?: onProgressFn
        signal?: AbortSignal
    }
) => {
    try {
        await mkdir(path, { recursive: true });

        await withRemoteGitClient({
            path,
            cloneUrl,
            credentials,
            onProgress,
            signal,
            operation: async (git) => {
                await git.clone(cloneUrl, path, ['--bare']);
            },
        });

        await unsetGitConfig({
            path,
            keys: ["remote.origin.url"],
            signal,
        });
    } catch (error: unknown) {
        const baseLog = `Failed to clone repository: ${path}`;

        if (error instanceof Error) {
            throw new Error(`${baseLog}. Reason: ${error.message}`);
        } else {
            throw new Error(`${baseLog}. Error: ${error}`);
        }
    }
};

export const fetchRepository = async (
    {
        cloneUrl,
        credentials,
        path,
        onProgress,
        signal,
    }: {
        cloneUrl: string,
        credentials?: GitHttpCredentials,
        path: string,
        onProgress?: onProgressFn,
        signal?: AbortSignal
    }
) => {
    try {
        await withRemoteGitClient({
            path,
            cloneUrl,
            credentials,
            onProgress,
            signal,
            operation: async (git) => {
                await git.fetch([
                    cloneUrl,
                    "+refs/heads/*:refs/heads/*",
                    "--prune",
                    "--progress",
                ]);
            },
        });

        // Update HEAD to match the remote's default branch. This handles the case where the remote's
        // default branch changes.
        const remoteDefaultBranch = await getRemoteDefaultBranch({
            path,
            cloneUrl,
            credentials,
            signal,
        });

        if (remoteDefaultBranch) {
            const git = createGitClientForPath(path, onProgress, signal);
            await git.raw(['symbolic-ref', 'HEAD', `refs/heads/${remoteDefaultBranch}`]);
        }
    } catch (error: unknown) {
        const baseLog = `Failed to fetch repository: ${path}`;
        if (error instanceof Error) {
            throw new Error(`${baseLog}. Reason: ${error.message}`);
        } else {
            throw new Error(`${baseLog}. Error: ${error}`);
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

export const isUrlAValidGitRepo = async ({
    cloneUrl,
    credentials,
}: {
    cloneUrl: string;
    credentials?: GitHttpCredentials;
}) => {
    // List the remote heads. If an exception is thrown, the URL is not a valid git repo.
    try {
        const result = await withRemoteGitClient({
            path: process.cwd(),
            cloneUrl,
            credentials,
            operation: async (git) => {
                return git.listRemote(['--heads', cloneUrl]);
            },
        });
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

const parseRefNames = (refs: string) =>
    refs
        .split('\n')
        .map((ref) => ref.trim())
        .filter(Boolean);

const getSortedRefs = async ({
    path,
    sort,
    refNamespace,
}: {
    path: string,
    sort: string,
    refNamespace: 'refs/heads' | 'refs/tags',
}) => {
    const git = createGitClientForPath(path);

    return parseRefNames(
        await git.raw([
            "for-each-ref",
            `--sort=${sort}`,
            "--format=%(refname:short)",
            refNamespace,
        ]),
    );
};

export const getBranches = async (path: string) => {
    return getSortedRefs({
        path,
        sort: "-committerdate",
        refNamespace: "refs/heads",
    });
};

export const getTags = async (path: string) => {
    return getSortedRefs({
        path,
        sort: "-creatordate",
        refNamespace: "refs/tags",
    });
};

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
        logger.debug(error);
        return undefined;
    }
}

/**
 * Gets the default branch name from the remote repository by querying what
 * the remote's HEAD symbolic ref points to.
 *
 * This is useful for detecting when a remote repository's default branch has
 * changed (e.g., from "master" to "main").
 *
 * @returns The branch name (e.g., "main", "master") or undefined if it cannot be determined
 */
export const getRemoteDefaultBranch = async ({
    path,
    cloneUrl,
    credentials,
    signal,
}: {
    path: string,
    cloneUrl: string,
    credentials?: GitHttpCredentials,
    signal?: AbortSignal,
}) => {
    try {
        const remoteHead = await withRemoteGitClient({
            path,
            cloneUrl,
            credentials,
            signal,
            operation: async (git) => {
                return git.raw(['ls-remote', '--symref', cloneUrl, 'HEAD']);
            },
        });
        const match = remoteHead.match(/^ref: refs\/heads\/(\S+)\s+HEAD/m);
        if (match) {
            return match[1];
        }
    } catch (error: unknown) {
        // Avoid printing error here since cloneUrl may contain credentials.
        console.error(`Failed to get remote default branch for repository: ${path}`);
        return undefined;
    }
}

/**
 * Gets the branch name that the local HEAD symbolic ref points to.
 *
 * In a git repository, HEAD is typically a symbolic reference that points to
 * a branch (e.g., refs/heads/main). This function resolves that symbolic ref
 * and returns just the branch name.
 *
 * @returns The branch name (e.g., "main", "master") or undefined if HEAD is not a symbolic ref
 */
export const getLocalDefaultBranch = async ({
    path,
}: {
    path: string,
}) => {
    const git = createGitClientForPath(path);

    try {
        const ref = await git.raw(['symbolic-ref', 'HEAD']);
        // Returns something like "refs/heads/main\n", so trim and remove prefix
        const trimmed = ref.trim();
        const match = trimmed.match(/^refs\/heads\/(.+)$/);
        if (match) {
            return match[1];
        }
    } catch (error: unknown) {
        console.error(`Failed to get local default branch for repository: ${path}`);
        return undefined;
    }
}

/**
 * Gets the timestamp of the most recent commit across all branches.
 *
 * @returns The Date of the most recent commit, or undefined if the repository
 *          is empty or if there's an error retrieving the timestamp.
 */
export const getLatestCommitTimestamp = async ({
    path,
}: {
    path: string,
}): Promise<Date | undefined> => {
    const git = createGitClientForPath(path);

    try {
        // git log --all -1 --format=%aI returns the author date of the most recent commit
        // across all branches in ISO 8601 format
        const result = await git.raw(['log', '--all', '-1', '--format=%aI']);
        const trimmed = result.trim();

        if (!trimmed) {
            return undefined; // Empty repository
        }

        const date = new Date(trimmed);
        if (isNaN(date.getTime())) {
            logger.warn(`Failed to parse commit timestamp: ${trimmed}`);
            return undefined;
        }

        return date;
    } catch (error) {
        logger.debug(`Failed to get latest commit timestamp for ${path}:`, error);
        return undefined;
    }
}

/**
 * Returns true if the git repository at the given path has no commits.
 */
export const isRepoEmpty = async ({
    path,
}: {
    path: string,
}): Promise<boolean> => {
    const git = createGitClientForPath(path);
    try {
        const result = await git.raw(['log', '--all', '-1', '--format=%H']);
        return result.trim() === '';
    } catch {
        return true;
    }
}

/**
 * Writes or updates the commit-graph file for the repository.
 * This pre-computes commit metadata to speed up operations like
 * rev-list --count, log, and merge-base.
 *
 * Also writes changed-path Bloom filters (--changed-paths), which let git
 * quickly skip commits that didn't touch a given path. This accelerates
 * `git log -- <path>` dramatically and `git blame` modestly on large repos.
 *
 * For incremental writes (the default), Bloom filters are only computed for
 * commits being added in this write. Repos that already have a Bloom-less
 * commit-graph from a prior version need a one-time `forceBackfill: true`
 * write to backfill filters for their historical commits.
 *
 * @see: https://git-scm.com/docs/commit-graph
 */
export const writeCommitGraph = async ({
    path,
    forceBackfill,
    onProgress,
    signal,
}: {
    path: string,
    forceBackfill?: boolean,
    onProgress?: onProgressFn,
    signal?: AbortSignal,
}): Promise<void> => {
    const git = createGitClientForPath(path, onProgress, signal);

    try {
        const args = ['commit-graph', 'write', '--reachable', '--changed-paths'];
        if (forceBackfill) {
            // --split=replace consolidates any existing layers into a single new layer,
            // which forces git to recompute Bloom filters for every commit (not just commits
            // added since the last write). Used for the one-time migration of repos that have
            // a Bloom-less commit-graph from before --changed-paths was enabled.
            // @see: https://git-scm.com/docs/git-commit-graph#Documentation/git-commit-graph.txt-write
            args.push('--split=replace');
        }
        await git.raw(args);
    } catch (error) {
        // Don't throw an exception here since this is just a performance optimization.
        logger.debug(`Failed to write commit-graph for ${path}:`, error);
    }
}
