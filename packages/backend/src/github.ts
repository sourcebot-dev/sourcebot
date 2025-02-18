import { Octokit } from "@octokit/rest";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { createLogger } from "./logger.js";
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import micromatch from "micromatch";
import { PrismaClient } from "@sourcebot/db";
import { FALLBACK_GITHUB_TOKEN } from "./environment.js";
import { BackendException, BackendError } from "@sourcebot/error";
const logger = createLogger("GitHub");

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
    }
}

export const getGitHubReposFromConfig = async (config: GithubConnectionConfig, orgId: number, db: PrismaClient, signal: AbortSignal) => {
    const tokenResult = config.token ? await getTokenFromConfig(config.token, orgId, db) : undefined;
    const token = tokenResult?.token;
    const secretKey = tokenResult?.secretKey;

    const octokit = new Octokit({
        auth: token ?? FALLBACK_GITHUB_TOKEN,
        ...(config.url ? {
            baseUrl: `${config.url}/api/v3`
        } : {}),
    });

    if (token) {
        try {
            await octokit.rest.users.getAuthenticated();
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
                throw new BackendException(BackendError.CONNECTION_SYNC_INVALID_TOKEN, {
                    secretKey,
                });
            }

            throw new BackendException(BackendError.CONNECTION_SYNC_SYSTEM_ERROR, {
                message: `Failed to authenticate with GitHub`,
            });
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

    try {
        if (config.orgs) {
            const _repos = await getReposForOrgs(config.orgs, octokit, signal);
            allRepos = allRepos.concat(_repos.validRepos);
            notFound.orgs = _repos.notFoundOrgs;
        }

        if (config.repos) {
            const _repos = await getRepos(config.repos, octokit, signal);
            allRepos = allRepos.concat(_repos.validRepos);
            notFound.repos = _repos.notFoundRepos;
        }

        if (config.users) {
            const isAuthenticated = config.token !== undefined;
            const _repos = await getReposOwnedByUsers(config.users, isAuthenticated, octokit, signal);
            allRepos = allRepos.concat(_repos.validRepos);
            notFound.users = _repos.notFoundUsers;
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
    } catch (error) {
        throw new BackendException(BackendError.CONNECTION_SYNC_SYSTEM_ERROR, {
            message: `Failed to fetch repositories: ${error}`,
        });
    }

}

export const shouldExcludeRepo = ({
    repo,
    include,
    exclude
} : {
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

const getReposOwnedByUsers = async (users: string[], isAuthenticated: boolean, octokit: Octokit, signal: AbortSignal) => {
    const results = await Promise.allSettled(users.map(async (user) => {
        try {
            logger.debug(`Fetching repository info for user ${user}...`);

            const { durationMs, data } = await measure(async () => {
                const fetchFn = async () => {
                    if (isAuthenticated) {
                        return octokit.paginate(octokit.repos.listForAuthenticatedUser, {
                            username: user,
                            visibility: 'all',
                            affiliation: 'owner',
                            per_page: 100,
                            request: {
                                signal,
                            },
                        });
                    } else {
                        return octokit.paginate(octokit.repos.listForUser, {
                            username: user,
                            per_page: 100,
                            request: {
                                signal,
                            },
                        });
                    }
                };

                return fetchWithRetry(fetchFn, `user ${user}`, logger);
            });

            logger.debug(`Found ${data.length} owned by user ${user} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                logger.error(`User ${user} not found or no access`);
                return {
                    type: 'notFound' as const,
                    user
                };
            }
            throw error;
        }
    }));

    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult && failedResult.status === 'rejected') {
        throw failedResult.reason;
    }

    const validRepos: any[] = [];
    const notFoundUsers: string[] = [];
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            if (result.value.type === 'valid') {
                validRepos.push(...result.value.data);
            } else {
                notFoundUsers.push(result.value.user);
            }
        }
    });

    return {
        validRepos,
        notFoundUsers,
    };
}

const getReposForOrgs = async (orgs: string[], octokit: Octokit, signal: AbortSignal) => {
    const results = await Promise.allSettled(orgs.map(async (org) => {
        try {
            logger.info(`Fetching repository info for org ${org}...`);

            const { durationMs, data } = await measure(async () => {
                const fetchFn = () => octokit.paginate(octokit.repos.listForOrg, {
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
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                logger.error(`Organization ${org} not found or no access`);
                return {
                    type: 'notFound' as const,
                    org
                };
            }
            throw error;
        }
    }));

    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult && failedResult.status === 'rejected') {
        throw failedResult.reason;
    }

    const validRepos: any[] = [];
    const notFoundOrgs: string[] = [];
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            if (result.value.type === 'valid') {
                validRepos.push(...result.value.data);
            } else {
                notFoundOrgs.push(result.value.org);
            }
        }
    });

    return {
        validRepos,
        notFoundOrgs,
    };
}

const getRepos = async (repoList: string[], octokit: Octokit, signal: AbortSignal) => {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        try {
            const [owner, repoName] = repo.split('/');
            logger.info(`Fetching repository info for ${repo}...`);

            const { durationMs, data: result } = await measure(async () => {
                const fetchFn = () => octokit.repos.get({
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
                data: result.data
            };

        } catch (error) {
            if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
                logger.error(`Repository ${repo} not found or no access`);
                return {
                    type: 'notFound' as const,
                    repo
                };
            }
            throw error;
        }
    }));

    // For now we'll throw an error (and thus fail the connection sync) if any repos threw an error.
    const failedResult = results.find(result => result.status === 'rejected');
    if (failedResult && failedResult.status === 'rejected') {
        throw failedResult.reason;
    }

    const validRepos: any[] = [];
    const notFoundRepos: string[] = [];
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            if (result.value.type === 'valid') {
                validRepos.push(result.value.data);
            } else {
                notFoundRepos.push(result.value.repo);
            }
        }
    });

    return {
        validRepos,
        notFoundRepos,
    };
}