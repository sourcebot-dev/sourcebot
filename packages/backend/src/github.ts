import { Octokit } from "@octokit/rest";
import { RequestError } from "@octokit/request-error";
import * as Sentry from "@sentry/node";
import { getTokenFromConfig } from "@sourcebot/shared";
import { createLogger } from "@sourcebot/shared";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { env, hasEntitlement } from "@sourcebot/shared";
import micromatch from "micromatch";
import pLimit from "p-limit";
import { processPromiseResults, throwIfAnyFailed } from "./connectionUtils.js";
import { GithubAppManager } from "./ee/githubAppManager.js";
import { fetchWithRetry, measure } from "./utils.js";

export const GITHUB_CLOUD_HOSTNAME = "github.com";

/**
 * GitHub token types and their prefixes.
 * @see https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/
 */
export type GitHubTokenType =
    | 'classic_pat'      // ghp_ - Personal Access Token (classic)
    | 'oauth_user'       // gho_ - OAuth App user token
    | 'app_user'         // ghu_ - GitHub App user token
    | 'app_installation' // ghs_ - GitHub App installation token
    | 'fine_grained_pat' // github_pat_ - Fine-grained PAT
    | 'unknown';

/**
 * Token types that support scope introspection via x-oauth-scopes header.
 */
export const SCOPE_INTROSPECTABLE_TOKEN_TYPES: GitHubTokenType[] = ['classic_pat', 'oauth_user'];

/**
 * Detects the GitHub token type based on its prefix.
 * @see https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/
 */
export const detectGitHubTokenType = (token: string): GitHubTokenType => {
    if (token.startsWith('ghp_')) return 'classic_pat';
    if (token.startsWith('gho_')) return 'oauth_user';
    if (token.startsWith('ghu_')) return 'app_user';
    if (token.startsWith('ghs_')) return 'app_installation';
    if (token.startsWith('github_pat_')) return 'fine_grained_pat';
    return 'unknown';
};

/**
 * Checks if a token type supports OAuth scope introspection via x-oauth-scopes header.
 */
export const supportsOAuthScopeIntrospection = (tokenType: GitHubTokenType): boolean => {
    return SCOPE_INTROSPECTABLE_TOKEN_TYPES.includes(tokenType);
};

/**
 * Type guard to check if an error is an Octokit RequestError.
 */
export const isOctokitRequestError = (error: unknown): error is RequestError => {
    return (
        error !== null &&
        typeof error === 'object' &&
        'status' in error &&
        typeof error.status === 'number' &&
        'name' in error &&
        error.name === 'HttpError'
    );
};

// Limit concurrent GitHub requests to avoid hitting rate limits and overwhelming installations.
const MAX_CONCURRENT_GITHUB_QUERIES = 5;
const githubQueryLimit = pLimit(MAX_CONCURRENT_GITHUB_QUERIES);
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
    default_branch?: string,
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
    const isGitHubCloud = url ? new URL(url).hostname === GITHUB_CLOUD_HOSTNAME : true;
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

export const getGitHubReposFromConfig = async (config: GithubConnectionConfig, signal: AbortSignal): Promise<{ repos: OctokitRepository[], warnings: string[] }> => {
    const hostname = config.url ?
        new URL(config.url).hostname :
        GITHUB_CLOUD_HOSTNAME;

    const token = config.token ?
        await getTokenFromConfig(config.token) :
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
            logger.error(`Failed to authenticate with GitHub`, error);
            throw error;
        }
    }

    let allRepos: OctokitRepository[] = [];
    let allWarnings: string[] = [];

    if (config.orgs) {
        const { repos, warnings } = await getReposForOrgs(config.orgs, octokit, signal, config.url);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.repos) {
        const { repos, warnings } = await getRepos(config.repos, octokit, signal, config.url);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.users) {
        const { repos, warnings } = await getReposOwnedByUsers(config.users, octokit, signal, config.url);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
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
        repos,
        warnings: allWarnings,
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

/**
 * Lists repositories that the authenticated user has explicit permission (:read, :write, or :admin) to access.
 * @see: https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
 */
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

/**
 * Gets OAuth scopes for a GitHub token.
 *
 * Returns `null` for token types that don't support scope introspection:
 * - GitHub App user tokens (ghu_)
 * - GitHub App installation tokens (ghs_)
 * - Fine-grained PATs (github_pat_)
 *
 * Returns scope array for tokens that support introspection:
 * - Classic PATs (ghp_)
 * - OAuth App user tokens (gho_)
 *
 * @see https://github.com/octokit/auth-token.js/?tab=readme-ov-file#find-out-what-scopes-are-enabled-for-oauth-tokens
 * @see https://github.blog/2021-04-05-behind-githubs-new-authentication-token-formats/
 */
export const getOAuthScopesForAuthenticatedUser = async (octokit: Octokit, token?: string): Promise<string[] | null> => {
    // If token is provided, check if it supports scope introspection
    if (token) {
        const tokenType = detectGitHubTokenType(token);
        if (!supportsOAuthScopeIntrospection(tokenType)) {
            return null;
        }
    }

    try {
        const response = await octokit.request("HEAD /");
        const scopes = response.headers["x-oauth-scopes"]?.split(/,\s+/) || [];
        return scopes;
    } catch (error) {
        Sentry.captureException(error);
        logger.error(`Failed to fetch OAuth scopes for authenticated user.`, error);
        throw error;
    }
}

const getReposOwnedByUsers = async (users: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(users.map((user) => githubQueryLimit(async () => {
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
                const warning = `User ${user} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw error;
        }
    })));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<OctokitRepository>(results);

    return {
        repos,
        warnings,
    };
}

const getReposForOrgs = async (orgs: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(orgs.map((org) => githubQueryLimit(async () => {
        try {
            logger.debug(`Fetching repository info for org ${org}...`);

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

            logger.debug(`Found ${data.length} in org ${org} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repositories for org ${org}.`, error);

            if (isHttpError(error, 404)) {
                const warning = `Organization ${org} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw error;
        }
    })));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<OctokitRepository>(results);

    return {
        repos,
        warnings,
    };
}

const getRepos = async (repoList: string[], octokit: Octokit, signal: AbortSignal, url?: string) => {
    const results = await Promise.allSettled(repoList.map((repo) => githubQueryLimit(async () => {
        try {
            const [owner, repoName] = repo.split('/');
            logger.debug(`Fetching repository info for ${repo}...`);

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

            logger.debug(`Found info for repository ${repo} in ${durationMs}ms`);
            return {
                type: 'valid' as const,
                data: [result.data]
            };

        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repository ${repo}.`, error);

            if (isHttpError(error, 404)) {
                const warning = `Repository ${repo} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw error;
        }
    })));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<OctokitRepository>(results);

    return {
        repos,
        warnings,
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
