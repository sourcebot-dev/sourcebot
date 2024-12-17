import { Octokit } from "@octokit/rest";
import { GitHubConfig } from "./schemas/v2.js";
import { createLogger } from "./logger.js";
import { AppContext, GitRepository } from "./types.js";
import path from 'path';
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, excludeReposByTopic, getTokenFromConfig, includeReposByTopic, marshalBool, measure } from "./utils.js";
import micromatch from "micromatch";

const logger = createLogger("GitHub");

type OctokitRepository = {
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
    let repos: GitRepository[] = allRepos
        .filter((repo) => {
            if (!repo.clone_url) {
                logger.warn(`Repository ${repo.name} missing property 'clone_url'. Excluding.`)
                return false;
            }
            return true;
        })
        .map((repo) => {
            const hostname = config.url ? new URL(config.url).hostname : 'github.com';
            const repoId = `${hostname}/${repo.full_name}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`));

            const cloneUrl = new URL(repo.clone_url!);
            if (token) {
                cloneUrl.username = token;
            }
            
            return {
                vcs: 'git',
                codeHost: 'github',
                name: repo.full_name,
                id: repoId,
                cloneUrl: cloneUrl.toString(),
                path: repoPath,
                isStale: false,
                isFork: repo.fork,
                isArchived: !!repo.archived,
                topics: repo.topics ?? [],
                gitConfigMetadata: {
                    'zoekt.web-url-type': 'github',
                    'zoekt.web-url': repo.html_url,
                    'zoekt.name': repoId,
                    'zoekt.github-stars': (repo.stargazers_count ?? 0).toString(),
                    'zoekt.github-watchers': (repo.watchers_count ?? 0).toString(),
                    'zoekt.github-subscribers': (repo.subscribers_count ?? 0).toString(),
                    'zoekt.github-forks': (repo.forks_count ?? 0).toString(),
                    'zoekt.archived': marshalBool(repo.archived),
                    'zoekt.fork': marshalBool(repo.fork),
                    'zoekt.public': marshalBool(repo.private === false)
                },
                sizeInBytes: repo.size ? repo.size * 1000 : undefined,
                branches: [],
                tags: [],
            } satisfies GitRepository;
        });

    if (config.topics) {
        const topics = config.topics.map(topic => topic.toLowerCase());
        repos = includeReposByTopic(repos, topics, logger);
    }

    if (config.exclude) {
        if (!!config.exclude.forks) {
            repos = excludeForkedRepos(repos, logger);
        }

        if (!!config.exclude.archived) {
            repos = excludeArchivedRepos(repos, logger);
        }

        if (config.exclude.repos) {
            repos = excludeReposByName(repos, config.exclude.repos, logger);
        }

        if (config.exclude.topics) {
            const topics = config.exclude.topics.map(topic => topic.toLowerCase());
            repos = excludeReposByTopic(repos, topics, logger);
        }

        if (config.exclude.size) {
            const min = config.exclude.size.min;
            const max = config.exclude.size.max;
            if (min) {
                repos = repos.filter((repo) => {
                    // If we don't have a size, we can't filter by size.
                    if (!repo.sizeInBytes) {
                        return true;
                    }

                    if (repo.sizeInBytes < min) {
                        logger.debug(`Excluding repo ${repo.name}. Reason: repo is less than \`exclude.size.min\`=${min} bytes.`);
                        return false;
                    }

                    return true;
                });
            }

            if (max) {
                repos = repos.filter((repo) => {
                    // If we don't have a size, we can't filter by size.
                    if (!repo.sizeInBytes) {
                        return true;
                    }

                    if (repo.sizeInBytes > max) {
                        logger.debug(`Excluding repo ${repo.name}. Reason: repo is greater than \`exclude.size.max\`=${max} bytes.`);
                        return false;
                    }

                    return true;
                });
            }
        }
    }

    logger.debug(`Found ${repos.length} total repositories.`);

    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            repos = await Promise.all(
                repos.map(async (repo) => {
                    const [owner, name] = repo.name.split('/');
                    let branches = (await getBranchesForRepo(owner, name, octokit, signal)).map(branch => branch.name);
                    branches = micromatch.match(branches, branchGlobs);

                    return {
                        ...repo,
                        branches,
                    };
                })
            )
        }

        if (config.revisions.tags) {
            const tagGlobs = config.revisions.tags;
            repos = await Promise.all(
                repos.map(async (repo) => {
                    const [owner, name] = repo.name.split('/');
                    let tags = (await getTagsForRepo(owner, name, octokit, signal)).map(tag => tag.name);
                    tags = micromatch.match(tags, tagGlobs);

                    return {
                        ...repo,
                        tags,
                    };
                })
            )
        }
    }

    return repos;
}

const getTagsForRepo = async (owner: string, repo: string, octokit: Octokit, signal: AbortSignal) => {
    logger.debug(`Fetching tags for repo ${owner}/${repo}...`);

    const { durationMs, data: tags } = await measure(() => octokit.paginate(octokit.repos.listTags, {
        owner,
        repo,
        per_page: 100,
        request: {
            signal
        }
    }));

    logger.debug(`Found ${tags.length} tags for repo ${owner}/${repo} in ${durationMs}ms`);
    return tags;
}

const getBranchesForRepo = async (owner: string, repo: string, octokit: Octokit, signal: AbortSignal) => {
    logger.debug(`Fetching branches for repo ${owner}/${repo}...`);
    const { durationMs, data: branches } = await measure(() => octokit.paginate(octokit.repos.listBranches, {
        owner,
        repo,
        per_page: 100,
        request: {
            signal
        }
    }));
    logger.debug(`Found ${branches.length} branches for repo ${owner}/${repo} in ${durationMs}ms`);
    return branches;
}


const getReposOwnedByUsers = async (users: string[], isAuthenticated: boolean, octokit: Octokit, signal: AbortSignal) => {
    // @todo : error handling
    const repos = (await Promise.all(users.map(async (user) => {
        logger.debug(`Fetching repository info for user ${user}...`);
        const start = Date.now();

        const result = await (() => {
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
        })();

        const duration = Date.now() - start;
        logger.debug(`Found ${result.length} owned by user ${user} in ${duration}ms.`);

        return result;
    }))).flat();

    return repos;
}

const getReposForOrgs = async (orgs: string[], octokit: Octokit, signal: AbortSignal) => {
    const repos = (await Promise.all(orgs.map(async (org) => {
        logger.debug(`Fetching repository info for org ${org}...`);
        const start = Date.now();

        const result = await octokit.paginate(octokit.repos.listForOrg, {
            org: org,
            per_page: 100,
            request: {
                signal
            }
        });

        const duration = Date.now() - start;
        logger.debug(`Found ${result.length} in org ${org} in ${duration}ms.`);

        return result;
    }))).flat();

    return repos;
}

const getRepos = async (repoList: string[], octokit: Octokit, signal: AbortSignal) => {
    const repos = await Promise.all(repoList.map(async (repo) => {
        logger.debug(`Fetching repository info for ${repo}...`);
        const start = Date.now();

        const [owner, repoName] = repo.split('/');
        const result = await octokit.repos.get({
            owner,
            repo: repoName,
            request: {
                signal
            }
        });

        const duration = Date.now() - start;
        logger.debug(`Found info for repository ${repo} in ${duration}ms`);

        return result.data;
    }));

    return repos;
}