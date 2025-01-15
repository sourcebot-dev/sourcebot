import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "./schemas/v2.js";
import { createLogger } from "./logger.js";
import { AppContext } from "./types.js";
import { getTokenFromConfig, measure } from "./utils.js";
import micromatch from "micromatch";

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
}

export const getGitHubReposFromConfig = async (config: GitHubConfig, signal: AbortSignal, ctx: AppContext) => {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;

    const octokit = new Octokit({
        auth: token,
        ...(config.url ? {
            baseUrl: `${config.url}/api/v3`
        } : {}),
    });

    let allRepos: OctokitRepository[] = [];

    if (config.orgs) {
        const _repos = await getReposForOrgs(config.orgs, octokit, signal);
        allRepos = allRepos.concat(_repos);
    }

    if (config.repos) {
        const _repos = await getRepos(config.repos, octokit, signal);
        allRepos = allRepos.concat(_repos);
    }

    if (config.users) {
        const isAuthenticated = config.token !== undefined;
        const _repos = await getReposOwnedByUsers(config.users, isAuthenticated, octokit, signal);
        allRepos = allRepos.concat(_repos);
    }

    // Marshall results to our type
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

    return repos;
}

export const getGitHubRepoFromId = async (id: string, hostURL: string, token?: string) => {
    const octokit = new Octokit({
        auth: token,
        ...(hostURL !== 'https://github.com' ? {
            baseUrl: `${hostURL}/api/v3`
        } : {})
    });

    const repo = await octokit.request('GET /repositories/:id', {
        id,
    });
    return repo;
}

export const shouldExcludeRepo = ({
    repo,
    include,
    exclude
} : {
    repo: OctokitRepository,
    include?: {
        topics?: GitHubConfig['topics']
    },
    exclude?: GitHubConfig['exclude']
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
    const repos = (await Promise.all(users.map(async (user) => {
        try {
            logger.debug(`Fetching repository info for user ${user}...`);

            const { durationMs, data } = await measure(async () => {
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
            });

            logger.debug(`Found ${data.length} owned by user ${user} in ${durationMs}ms.`);
            return data;
        } catch (e) {
            logger.error(`Failed to fetch repository info for user ${user}.`, e);
            return [];
        }
    }))).flat();

    return repos;
}

const getReposForOrgs = async (orgs: string[], octokit: Octokit, signal: AbortSignal) => {
    const repos = (await Promise.all(orgs.map(async (org) => {
        try {
            logger.debug(`Fetching repository info for org ${org}...`);

            const { durationMs, data } = await measure(() => octokit.paginate(octokit.repos.listForOrg, {
                org: org,
                per_page: 100,
                request: {
                    signal
                }
            }));

            logger.debug(`Found ${data.length} in org ${org} in ${durationMs}ms.`);
            return data;
        } catch (e) {
            logger.error(`Failed to fetch repository info for org ${org}.`, e);
            return [];
        }
    }))).flat();

    return repos;
}

const getRepos = async (repoList: string[], octokit: Octokit, signal: AbortSignal) => {
    const repos = (await Promise.all(repoList.map(async (repo) => {
        try {
            logger.debug(`Fetching repository info for ${repo}...`);

            const [owner, repoName] = repo.split('/');
            const { durationMs, data: result } = await measure(() => octokit.repos.get({
                owner,
                repo: repoName,
                request: {
                    signal
                }
            }));

            logger.debug(`Found info for repository ${repo} in ${durationMs}ms`);

            return [result.data];
        } catch (e) {
            logger.error(`Failed to fetch repository info for ${repo}.`, e);
            return [];
        }
    }))).flat();

    return repos;
}