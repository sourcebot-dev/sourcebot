import { Logger } from "winston";
import { RepoAuthCredentials, RepoWithConnections } from "./types.js";
import path from 'path';
import { PrismaClient, Repo } from "@sourcebot/db";
import { getTokenFromConfig } from "@sourcebot/crypto";
import * as Sentry from "@sentry/node";
import { GithubConnectionConfig, GitlabConnectionConfig, GiteaConnectionConfig, BitbucketConnectionConfig, AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { GithubAppManager } from "./ee/githubAppManager.js";
import { hasEntitlement } from "@sourcebot/shared";
import { REPOS_CACHE_DIR } from "./constants.js";

export const measure = async <T>(cb: () => Promise<T>) => {
    const start = Date.now();
    const data = await cb();
    const durationMs = Date.now() - start;
    return {
        data,
        durationMs
    }
}

export const marshalBool = (value?: boolean) => {
    return !!value ? '1' : '0';
}

export const resolvePathRelativeToConfig = (localPath: string, configPath: string) => {
    let absolutePath = localPath;
    if (!path.isAbsolute(absolutePath)) {
        if (absolutePath.startsWith('~')) {
            absolutePath = path.join(process.env.HOME ?? '', absolutePath.slice(1));
        }

        absolutePath = path.resolve(path.dirname(configPath), absolutePath);
    }

    return absolutePath;
}

export const arraysEqualShallow = <T>(a?: readonly T[], b?: readonly T[]) => {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    if (a.length !== b.length) return false;

    const aSorted = a.toSorted();
    const bSorted = b.toSorted();

    for (let i = 0; i < aSorted.length; i++) {
        if (aSorted[i] !== bSorted[i]) {
            return false;
        }
    }

    return true;
}

// @note: this function is duplicated in `packages/web/src/features/fileTree/actions.ts`.
// @todo: we should move this to a shared package.
export const getRepoPath = (repo: Repo): { path: string, isReadOnly: boolean } => {
    // If we are dealing with a local repository, then use that as the path.
    // Mark as read-only since we aren't guaranteed to have write access to the local filesystem.
    const cloneUrl = new URL(repo.cloneUrl);
    if (repo.external_codeHostType === 'genericGitHost' && cloneUrl.protocol === 'file:') {
        return {
            path: cloneUrl.pathname,
            isReadOnly: true,
        }
    }

    return {
        path: path.join(REPOS_CACHE_DIR, repo.id.toString()),
        isReadOnly: false,
    }
}

export const getShardPrefix = (orgId: number, repoId: number) => {
    return `${orgId}_${repoId}`;
}

export const fetchWithRetry = async <T>(
    fetchFn: () => Promise<T>,
    identifier: string,
    logger: Logger,
    maxAttempts: number = 3
): Promise<T> => {
    let attempts = 0;

    while (true) {
        try {
            return await fetchFn();
        } catch (e: any) {
            Sentry.captureException(e);

            attempts++;
            if ((e.status === 403 || e.status === 429 || e.status === 443) && attempts < maxAttempts) {
                const computedWaitTime = 3000 * Math.pow(2, attempts - 1);
                const resetTime = e.response?.headers?.['x-ratelimit-reset'] ? parseInt(e.response.headers['x-ratelimit-reset']) * 1000 : Date.now() + computedWaitTime;
                const waitTime = resetTime - Date.now();
                logger.warn(`Rate limit exceeded for ${identifier}. Waiting ${waitTime}ms before retry ${attempts}/${maxAttempts}...`);

                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            throw e;
        }
    }
}

// TODO: do this better? ex: try using the tokens from all the connections 
// We can no longer use repo.cloneUrl directly since it doesn't contain the token for security reasons. As a result, we need to
// fetch the token here using the connections from the repo. Multiple connections could be referencing this repo, and each
// may have their own token. This method will just pick the first connection that has a token (if one exists) and uses that. This
// may technically cause syncing to fail if that connection's token just so happens to not have access to the repo it's referencing.
export const getAuthCredentialsForRepo = async (repo: RepoWithConnections, db: PrismaClient, logger?: Logger): Promise<RepoAuthCredentials | undefined> => {
    // If we have github apps configured we assume that we must use them for github service auth
    if (repo.external_codeHostType === 'github' && hasEntitlement('github-app') && GithubAppManager.getInstance().appsConfigured()) {
        logger?.debug(`Using GitHub App for service auth for repo ${repo.displayName} hosted at ${repo.external_codeHostUrl}`);

        const owner = repo.displayName?.split('/')[0];
        const deploymentHostname = new URL(repo.external_codeHostUrl).hostname;
        if (!owner || !deploymentHostname) {
            throw new Error(`Failed to fetch GitHub App for repo ${repo.displayName}:Invalid repo displayName (${repo.displayName}) or deployment hostname (${deploymentHostname})`);
        }

        const token = await GithubAppManager.getInstance().getInstallationToken(owner, deploymentHostname);
        return {
            hostUrl: repo.external_codeHostUrl,
            token,
            cloneUrlWithToken: createGitCloneUrlWithToken(
                repo.cloneUrl,
                {
                    username: 'x-access-token',
                    password: token
                }
            ),
        }
    }

    for (const { connection } of repo.connections) {
        if (connection.connectionType === 'github') {
            const config = connection.config as unknown as GithubConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token, connection.orgId, db);
                return {
                    hostUrl: config.url,
                    token,
                    cloneUrlWithToken: createGitCloneUrlWithToken(
                        repo.cloneUrl,
                        {
                            password: token,
                        }
                    ),
                }
            }
        } else if (connection.connectionType === 'gitlab') {
            const config = connection.config as unknown as GitlabConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token, connection.orgId, db);
                return {
                    hostUrl: config.url,
                    token,
                    cloneUrlWithToken: createGitCloneUrlWithToken(
                        repo.cloneUrl,
                        {
                            username: 'oauth2',
                            password: token
                        }
                    ),
                }
            }
        } else if (connection.connectionType === 'gitea') {
            const config = connection.config as unknown as GiteaConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token, connection.orgId, db);
                return {
                    hostUrl: config.url,
                    token,
                    cloneUrlWithToken: createGitCloneUrlWithToken(
                        repo.cloneUrl,
                        {
                            password: token
                        }
                    ),
                }
            }
        } else if (connection.connectionType === 'bitbucket') {
            const config = connection.config as unknown as BitbucketConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token, connection.orgId, db);
                const username = config.user ?? 'x-token-auth';
                return {
                    hostUrl: config.url,
                    token,
                    cloneUrlWithToken: createGitCloneUrlWithToken(
                        repo.cloneUrl,
                        {
                            username,
                            password: token
                        }
                    ),
                }
            }
        } else if (connection.connectionType === 'azuredevops') {
            const config = connection.config as unknown as AzureDevOpsConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token, connection.orgId, db);

                // For ADO server, multiple auth schemes may be supported. If the ADO deployment supports NTLM, the git clone will default
                // to this over basic auth. As a result, we cannot embed the token in the clone URL and must force basic auth by passing in the token
                // appropriately in the header. To do this, we set the authHeader field here
                if (config.deploymentType === 'server') {
                    return {
                        hostUrl: config.url,
                        token,
                        authHeader: "Authorization: Basic " + Buffer.from(`:${token}`).toString('base64')
                    }
                } else {
                    return {
                        hostUrl: config.url,
                        token,
                        cloneUrlWithToken: createGitCloneUrlWithToken(
                            repo.cloneUrl,
                            {
                                // @note: If we don't provide a username, the password will be set as the username. This seems to work
                                // for ADO cloud but not for ADO server. To fix this, we set a placeholder username to ensure the password
                                // is set correctly
                                username: 'user',
                                password: token
                            }
                        ),
                    }
                }
            }
        }
    }

    return undefined;
}

const createGitCloneUrlWithToken = (cloneUrl: string, credentials: { username?: string, password: string }) => {
    const url = new URL(cloneUrl);
    // @note: URL has a weird behavior where if you set the password but
    // _not_ the username, the ":" delimiter will still be present in the
    // URL (e.g., https://:password@example.com). To get around this, if
    // we only have a password, we set the username to the password.
    // @see: https://www.typescriptlang.org/play/?#code/MYewdgzgLgBArgJwDYwLwzAUwO4wKoBKAMgBQBEAFlFAA4QBcA9I5gB4CGAtjUpgHShOZADQBKANwAoREj412ECNhAIAJmhhl5i5WrJTQkELz5IQAcxIy+UEAGUoCAJZhLo0UA
    if (!credentials.username) {
        url.username = credentials.password;
    } else {
        url.username = credentials.username;
        url.password = credentials.password;
    }
    return url.toString();
}


/**
 * Wraps groupmq worker lifecycle callbacks with exception handling. This prevents
 * uncaught exceptions (e.g., like a RepoIndexingJob not existing in the DB) from crashing
 * the app. 
 * @see: https://openpanel-dev.github.io/groupmq/api-worker/#events
 */
export const groupmqLifecycleExceptionWrapper = async (name: string, logger: Logger, fn: () => Promise<void>) => {
    try {
        await fn();
    } catch (error) {
        Sentry.captureException(error);
        logger.error(`Exception thrown while executing lifecycle function \`${name}\`.`, error);
    }
}

