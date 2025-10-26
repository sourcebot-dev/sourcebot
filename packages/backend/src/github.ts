import { Octokit } from "@octokit/rest";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { createLogger } from "@sourcebot/logger";
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import micromatch from "micromatch";
import { PrismaClient } from "@sourcebot/db";
import { BackendException, BackendError } from "@sourcebot/error";
import { processPromiseResults, throwIfAnyFailed } from "./connectionUtils.js";
import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { GithubAppManager } from "./ee/githubAppManager.js";
import { hasEntitlement } from "@sourcebot/shared";

export const GITHUB_CLOUD_HOSTNAME = "github.com";
const logger = createLogger('github');

export type OctokitRepository = {
    name: string,
    id: number,
    full_name: string,
    fork: boolean,
    private: boolean,
    html_url: string,
    clone_url?: string,
    stargazers_count?: number,
    watchers_count?: number,
    subscribers_count?: number,
    forks_count?: number,
    archived?: boolean,
    topics?: string[],
    // @note: this is expressed in kilobytes.
    size?: number,
    owner: {
        avatar_url: string,
        login: string,
    }
}

const isHttpError = (error: unknown, status: number): boolean => {
    return error !== null
        && typeof error === 'object'
        && 'status' in error
        && error.status === status;
}

export const createOctokitFromToken = async ({ token, url }: { token?: string, url?: string }): Promise<{ octokit: Octokit, isAuthenticated: boolean }> => {
    const isGitHubCloud = url ? new URL(url).hostname === GITHUB_CLOUD_HOSTNAME : false;
    const octokit = new Octokit({
        auth: token,
        ...(url && !isGitHubCloud ? {
            baseUrl: `${url}/api/v3`
        } : {}),
    });

    return {
        octokit,
        isAuthenticated: !!token,
    };
}

/**
 * Helper function to get an authenticated Octokit instance using GitHub App if available,
 * otherwise falls back to the provided octokit instance.
 */
const getOctokitWithGithubApp = async (
    octokit: Octokit,
    owner: string,
    url: string | undefined,
    context: string
): Promise<Octokit> => {
    if (!hasEntitlement('github-app') || !GithubAppManager.getInstance().appsConfigured()) {
        return octokit;
    }

    try {
        const hostname = url ? new URL(url).hostname : GITHUB_CLOUD_HOSTNAME;
        const token = await GithubAppManager.getInstance().getInstallationToken(owner, hostname);
        const { octokit: octokitFromToken, isAuthenticated } = await createOctokitFromToken({
            token,
            url,
        });

        if (isAuthenticated) {
            return octokitFromToken;
        } else {
            logger.error(`Failed to authenticate with GitHub App for ${context}. Falling back to legacy token resolution.`);
            return octokit;
        }
    } catch (error) {
        logger.error(`Error getting GitHub App token for ${context}. Falling back to legacy token resolution.`, error);
        return octokit;
    }
}

export const getGitHubReposFromConfig = async (config: GithubConnectionConfig, orgId: number, db: PrismaClient, signal: AbortSignal) => {
    const hostname = config.url ?
        new URL(config.url).hostname :
        GITHUB_CLOUD_HOSTNAME;

    const token = config.token ?
        await getTokenFromConfig(config.token, orgId, db, logger) :
        hostname === GITHUB_CLOUD_HOSTNAME ?
            env.FALLBACK_GITHUB_CLOUD_TOKEN :
            undefined;

    const { octokit, isAuthenticated } = await createOctokitFromToken({
        token,
        url: config.url,
    });

    if (isAuthenticated) {
        try {
            await octokit.rest.users.getAuthenticated();
        } catch (error) {
            Sentry.captureException(error);

            if (isHttpError(error, 401)) {
                const e = new BackendException(BackendError.CONNECTION_SYNC_INVALID_TOKEN, {
                    ...(config.token && 'secret' in config.token ? {
                        secretKey: config.token.secret,
                    } : {}),
                });
                Sentry.captureException(e);
                throw e;
            }

            const e = new BackendException(BackendError.CONNECTION_SYNC_SYSTEM_ERROR, {
                message: `Failed to authenticate with GitHub`,
            });
            Sentry.captureException(e);
            throw e;
        }
    }

    let allRepos: OctokitRepository[] = [];
    let notFound: {
        users: string[],
        orgs: string[],
        repos: string[],
    } = {
        users: [],
        orgs: [],
        repos: [],
    };

    if (config.orgs) {
        const { validRepos, notFoundOrgs } = await getReposForOrgs(config.orgs, octokit, signal, config.url);
        allRepos = allRepos.concat(validRepos);
        notFound.orgs = notFoundOrgs;
    }

    if (config.repos) {
        const { validRepos, notFoundRepos } = await getRepos(config.repos, octokit, signal, config.url);
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFoundRepos;
    }

    if (config.users) {
        const { validRepos, notFoundUsers } = await getReposOwnedByUsers(config.users, octokit, signal, config.url);
        allRepos = allRepos.concat(validRepos);
        notFound.users = notFoundUsers;
    }

    let repos = allRepos
        .filter((repo) => {
            const isExcluded = shouldExcludeRepo({
                repo,
                include: {
                    topics: config.topics,
                },
                exclude: config.exclude,
            });

            return !isExcluded;
        });

    logger.debug(`Found ${repos.length} total repositories.`);

    return {
        validRepos: repos,
        notFound,
    };
}

export const getRepoCollaborators = async (owner: string, repo: string, octokit: Octokit) => {
    try {
        const fetchFn = () => octokit.paginate(octokit.repos.listCollaborators, {
            owner,
            repo,
            per_page: 100,
        });

        const collaborators = await fetchWithRetry(fetchFn, `repo ${owner}/${repo}`, logger);
        return collaborators;
    } catch (error) {
        Sentry.captureException(error);
        logger.error(`Failed to fetch collaborators for repo ${owner}/${repo}.`, error);
        throw error;
    }
}

export const getReposForAuthenticatedUser = async (visibility: 'all' | 'private' | 'public' = 'all', octokit: Octokit) => {
    try {
        const fetchFn = () => octokit.paginate(octokit.repos.listForAuthenticatedUser, {
            per_page: 100,
            visibility,
        });

        const repos = await fetchWithRetry(fetchFn, `authenticated user`, logger);
        return repos;
    } catch (error) {
        Sentry.captureException(error);
        logger.error(`Failed to fetch repositories for authenticated user.`, error);
        throw error;
    }
}

const getReposOwnedByUsers = async (users: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(users.map(async (user) => {
        try {
            logger.debug(`Fetching repository info for user ${user}...`);

            const octokitToUse = await getOctokitWithGithubApp(octokit, user, url, `user ${user}`);
            const { durationMs, data } = await measure(async () => {
                const fetchFn = async () => {
                    let query = `user:${user}`;
                    // To include forks in the search results, we will need to add fork:true
                    // see: https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories
                    query += ' fork:true';
                    // @note: We need to use GitHub's search API here since it is the only way
                    // to get all repositories (private and public) owned by a user that supports
                    // the username as a parameter.
                    // @see: https://github.com/orgs/community/discussions/24382#discussioncomment-3243958
                    // @see: https://api.github.com/search/repositories?q=user:USERNAME
                    const searchResults = await octokitToUse.paginate(octokitToUse.rest.search.repos, {
                        q: query,
                        per_page: 100,
                        request: {
                            signal,
                        },
                    });

                    return searchResults as OctokitRepository[];
                };

                return fetchWithRetry(fetchFn, `user ${user}`, logger);
            });

            logger.debug(`Found ${data.length} owned by user ${user} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repositories for user ${user}.`, error);

            if (isHttpError(error, 404)) {
                logger.error(`User ${user} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: user
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundUsers } = processPromiseResults<OctokitRepository>(results);

    return {
        validRepos,
        notFoundUsers,
    };
}

const getReposForOrgs = async (orgs: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(orgs.map(async (org) => {
        try {
            logger.info(`Fetching repository info for org ${org}...`);

            const octokitToUse = await getOctokitWithGithubApp(octokit, org, url, `org ${org}`);
            const { durationMs, data } = await measure(async () => {
                const fetchFn = () => octokitToUse.paginate(octokitToUse.repos.listForOrg, {
                    org: org,
                    per_page: 100,
                    request: {
                        signal
                    }
                });

                return fetchWithRetry(fetchFn, `org ${org}`, logger);
            });

            logger.info(`Found ${data.length} in org ${org} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repositories for org ${org}.`, error);

            if (isHttpError(error, 404)) {
                logger.error(`Organization ${org} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: org
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundOrgs } = processPromiseResults<OctokitRepository>(results);

    return {
        validRepos,
        notFoundOrgs,
    };
}

const getRepos = async (repoList: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        try {
            const [owner, repoName] = repo.split('/');
            logger.info(`Fetching repository info for ${repo}...`);

            const octokitToUse = await getOctokitWithGithubApp(octokit, owner, url, `repo ${repo}`);
            const { durationMs, data: result } = await measure(async () => {
                const fetchFn = () => octokitToUse.repos.get({
                    owner,
                    repo: repoName,
                    request: {
                        signal
                    }
                });

                return fetchWithRetry(fetchFn, repo, logger);
            });

            logger.info(`Found info for repository ${repo} in ${durationMs}ms`);
            return {
                type: 'valid' as const,
                data: [result.data]
            };

        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repository ${repo}.`, error);

            if (isHttpError(error, 404)) {
                logger.error(`Repository ${repo} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: repo
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundRepos } = processPromiseResults<OctokitRepository>(results);

    return {
        validRepos,
        notFoundRepos,
    };
}

export const shouldExcludeRepo = ({
    repo,
    include,
    exclude
}: {
    repo: OctokitRepository,
    include?: {
        topics?: GithubConnectionConfig['topics']
    },
    exclude?: GithubConnectionConfig['exclude']
}) => {
    let reason = '';
    const repoName = repo.full_name;

    const shouldExclude = (() => {
        if (!repo.clone_url) {
            reason = 'clone_url is undefined';
            return true;
        }

        if (!!exclude?.forks && repo.fork) {
            reason = `\`exclude.forks\` is true`;
            return true;
        }

        if (!!exclude?.archived && !!repo.archived) {
            reason = `\`exclude.archived\` is true`;
            return true;
        }

        if (exclude?.repos) {
            if (micromatch.isMatch(repoName, exclude.repos)) {
                reason = `\`exclude.repos\` contains ${repoName}`;
                return true;
            }
        }

        if (exclude?.topics) {
            const configTopics = exclude.topics.map(topic => topic.toLowerCase());
            const repoTopics = repo.topics ?? [];

            const matchingTopics = repoTopics.filter((topic) => micromatch.isMatch(topic, configTopics));
            if (matchingTopics.length > 0) {
                reason = `\`exclude.topics\` matches the following topics: ${matchingTopics.join(', ')}`;
                return true;
            }
        }

        if (include?.topics) {
            const configTopics = include.topics.map(topic => topic.toLowerCase());
            const repoTopics = repo.topics ?? [];

            const matchingTopics = repoTopics.filter((topic) => micromatch.isMatch(topic, configTopics));
            if (matchingTopics.length === 0) {
                reason = `\`include.topics\` does not match any of the following topics: ${configTopics.join(', ')}`;
                return true;
            }
        }

        const repoSizeInBytes = repo.size ? repo.size * 1000 : undefined;
        if (exclude?.size && repoSizeInBytes) {
            const min = exclude.size.min;
            const max = exclude.size.max;

            if (min && repoSizeInBytes < min) {
                reason = `repo is less than \`exclude.size.min\`=${min} bytes.`;
                return true;
            }

            if (max && repoSizeInBytes > max) {
                reason = `repo is greater than \`exclude.size.max\`=${max} bytes.`;
                return true;
            }
        }

        return false;
    })();

    if (shouldExclude) {
        logger.debug(`Excluding repo ${repoName}. Reason: ${reason}`);
        return true;
    }

    return false;
}
