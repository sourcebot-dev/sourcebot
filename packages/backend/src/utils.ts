import { Logger } from "winston";
import { RepoAuthCredentials, RepoWithConnections } from "./types.js";
import path from 'path';
import { env, getTokenFromConfig } from "@sourcebot/shared";
import * as Sentry from "@sentry/node";
import { GithubConnectionConfig, GitlabConnectionConfig, GiteaConnectionConfig, BitbucketConnectionConfig, AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { GithubAppManager } from "./ee/githubAppManager.js";
import { hasEntitlement } from "./entitlements.js";
import { StatusCodes } from "http-status-codes";
import { isOctokitRequestError } from "./github.js";

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

export const getShardPrefix = (orgId: number, repoId: number) => {
    return `${orgId}_${repoId}`;
}

export const getRepoIdFromShardFileName = (fileName: string): number | undefined => {
    const match = fileName.match(/^(\d+)_(\d+)_/);
    if (!match) {
        return undefined;
    }
    return parseInt(match[2], 10);
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
            if (
                (
                    (e.status >= 500 && e.status < 600) ||
                    e.status === StatusCodes.FORBIDDEN ||
                    e.status === StatusCodes.TOO_MANY_REQUESTS
                ) && attempts < maxAttempts
            ) {
                const resetDateMs = (() => {
                    // First, try to see if we have a reset date specified in the response headers
                    if (isOctokitRequestError(e) && e.response?.headers['x-ratelimit-reset']) {
                        return parseInt(e.response.headers['x-ratelimit-reset']) * 1000;
                    }

                    // Default to a exponential backoff approach
                    const defaultWaitTime = 3000 * Math.pow(2, attempts - 1);
                    return Date.now() + defaultWaitTime;
                })();

                const waitTime = Math.max(0, resetDateMs - Date.now());
                logger.warn(`Request failed for ${identifier} with status ${e.status}. Waiting ${waitTime}ms before retry ${attempts}/${maxAttempts}...`);

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
export const getAuthCredentialsForRepo = async (repo: RepoWithConnections, logger?: Logger): Promise<RepoAuthCredentials | undefined> => {
    if (repo.external_codeHostType === 'github' && env.EXPERIMENT_ASK_GH_GITHUB_TOKEN) {
        logger?.debug(`Using Ask GitHub PAT for service auth for repo ${repo.displayName} hosted at ${repo.external_codeHostUrl}`);

        const token = env.EXPERIMENT_ASK_GH_GITHUB_TOKEN;
        return {
            hostUrl: repo.external_codeHostUrl,
            token,
            gitHttpCredentials: {
                username: 'x-access-token',
                password: token,
            },
        };
    }

    if (repo.external_codeHostType === 'github') {
        const githubAppManager = GithubAppManager.getInstance();
        await githubAppManager.ensureInitialized();

        if (githubAppManager.appsConfigured()) {
            if (!await hasEntitlement('github-app')) {
                throw new Error(`GitHub App authentication is not currently licensed for repo ${repo.displayName}.`);
            }

            logger?.debug(`Using GitHub App for service auth for repo ${repo.displayName} hosted at ${repo.external_codeHostUrl}`);

            const owner = repo.displayName?.split('/')[0];
            const deploymentHostname = new URL(repo.external_codeHostUrl).hostname;
            if (!owner || !deploymentHostname) {
                throw new Error(`Failed to fetch GitHub App for repo ${repo.displayName}:Invalid repo displayName (${repo.displayName}) or deployment hostname (${deploymentHostname})`);
            }

            const token = await githubAppManager.getInstallationToken(owner, deploymentHostname);
            if (token) {
                return {
                    hostUrl: repo.external_codeHostUrl,
                    token,
                    gitHttpCredentials: {
                        username: 'x-access-token',
                        password: token,
                    },
                }
            }
        }
    }

    for (const { connection } of repo.connections) {
        if (connection.connectionType === 'github') {
            const config = connection.config as unknown as GithubConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token);
                return {
                    hostUrl: config.url,
                    token,
                    gitHttpCredentials: {
                        username: 'x-access-token',
                        password: token,
                    },
                    connectionConfig: config,
                }
            }
        } else if (connection.connectionType === 'gitlab') {
            const config = connection.config as unknown as GitlabConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token);
                return {
                    hostUrl: config.url,
                    token,
                    gitHttpCredentials: {
                        username: 'oauth2',
                        password: token,
                    },
                    connectionConfig: config,
                }
            }
        } else if (connection.connectionType === 'gitea') {
            const config = connection.config as unknown as GiteaConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token);
                return {
                    hostUrl: config.url,
                    token,
                    gitHttpCredentials: {
                        username: token,
                        password: '',
                    },
                    connectionConfig: config,
                }
            }
        } else if (connection.connectionType === 'bitbucket') {
            const config = connection.config as unknown as BitbucketConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token);
                const username = config.gitUser ?? config.user ?? 'x-token-auth';
                return {
                    hostUrl: config.url,
                    token,
                    gitHttpCredentials: {
                        username,
                        password: token,
                    },
                    connectionConfig: config,
                }
            }
        } else if (connection.connectionType === 'azuredevops') {
            const config = connection.config as unknown as AzureDevOpsConnectionConfig;
            if (config.token) {
                const token = await getTokenFromConfig(config.token);

                // ADO Server may advertise NTLM alongside Basic authentication. Force
                // proactive Basic auth there so libcurl does not select NTLM first.
                return {
                    hostUrl: config.url,
                    token,
                    gitHttpCredentials: {
                        username: 'user',
                        password: token,
                        ...(config.deploymentType === 'server' ? {
                            proactiveAuth: 'basic' as const,
                        } : {}),
                    },
                    connectionConfig: config,
                };
            }
        }
    }

    return undefined;
}

// setInterval wrapper that ensures async callbacks are not executed concurrently.
// @see: https://mottaquikarim.github.io/dev/posts/setinterval-that-blocks-on-await/
export const setIntervalAsync = (target: () => Promise<void>, pollingIntervalMs: number): NodeJS.Timeout => {
    const setIntervalWithPromise = <T extends (...args: any[]) => Promise<any>>(
        target: T
    ): (...args: Parameters<T>) => Promise<void> => {
        return async function (...args: Parameters<T>): Promise<void> {
            if ((target as any).isRunning) return;

            (target as any).isRunning = true;
            try {
                await target(...args);
            } finally {
                (target as any).isRunning = false;
            }
        };
    }

    return setInterval(
        setIntervalWithPromise(target),
        pollingIntervalMs
    );
}
