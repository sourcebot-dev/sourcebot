import { Api, giteaApi, HttpResponse, Repository as GiteaRepository } from 'gitea-js';
import { GiteaConfig } from "@sourcebot/schemas/v2/index.type"
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, getTokenFromConfig, marshalBool, measure } from './utils.js';
import { AppContext, GitRepository } from './types.js';
import fetch from 'cross-fetch';
import { createLogger } from './logger.js';
import path from 'path';
import micromatch from 'micromatch';

const logger = createLogger('Gitea');

export const getGiteaReposFromConfig = async (config: GiteaConfig, ctx: AppContext) => {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;

    const api = giteaApi(config.url ?? 'https://gitea.com', {
        token,
        customFetch: fetch,
    });

    let allRepos: GiteaRepository[] = [];

    if (config.orgs) {
        const _repos = await getReposForOrgs(config.orgs, api);
        allRepos = allRepos.concat(_repos);
    }

    if (config.repos) {
        const _repos = await getRepos(config.repos, api);
        allRepos = allRepos.concat(_repos);
    }

    if (config.users) {
        const _repos = await getReposOwnedByUsers(config.users, api);
        allRepos = allRepos.concat(_repos);
    }

    let repos: GitRepository[] = allRepos
        .map((repo) => {
            const hostname = config.url ? new URL(config.url).hostname : 'gitea.com';
            const repoId = `${hostname}/${repo.full_name!}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`));

            const cloneUrl = new URL(repo.clone_url!);
            if (token) {
                cloneUrl.username = token;
            }

            return {
                vcs: 'git',
                codeHost: 'gitea',
                name: repo.full_name!,
                id: repoId,
                cloneUrl: cloneUrl.toString(),
                path: repoPath,
                isStale: false,
                isFork: repo.fork!,
                isArchived: !!repo.archived,
                gitConfigMetadata: {
                    'zoekt.web-url-type': 'gitea',
                    'zoekt.web-url': repo.html_url!,
                    'zoekt.name': repoId,
                    'zoekt.archived': marshalBool(repo.archived),
                    'zoekt.fork': marshalBool(repo.fork!),
                    'zoekt.public': marshalBool(repo.internal === false && repo.private === false),
                },
                branches: [],
                tags: []
            } satisfies GitRepository;
        });
    
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
    }

    logger.debug(`Found ${repos.length} total repositories.`);

    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            repos = await Promise.all(
                repos.map(async (repo) => {
                    const [owner, name] = repo.name.split('/');
                    let branches = (await getBranchesForRepo(owner, name, api)).map(branch => branch.name!);
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
                    let tags = (await getTagsForRepo(owner, name, api)).map(tag => tag.name!);
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

const getTagsForRepo = async <T>(owner: string, repo: string, api: Api<T>) => {
    try {
        logger.debug(`Fetching tags for repo ${owner}/${repo}...`);
        const { durationMs, data: tags } = await measure(() =>
            paginate((page) => api.repos.repoListTags(owner, repo, {
                page
            }))
        );
        logger.debug(`Found ${tags.length} tags in repo ${owner}/${repo} in ${durationMs}ms.`);
        return tags;
    } catch (e) {
        logger.error(`Failed to fetch tags for repo ${owner}/${repo}.`, e);
        return [];
    }
}

const getBranchesForRepo = async <T>(owner: string, repo: string, api: Api<T>) => {
    try {
        logger.debug(`Fetching branches for repo ${owner}/${repo}...`);
        const { durationMs, data: branches } = await measure(() => 
            paginate((page) => api.repos.repoListBranches(owner, repo, {
                page
            }))
        );
        logger.debug(`Found ${branches.length} branches in repo ${owner}/${repo} in ${durationMs}ms.`);
        return branches;
    } catch (e) {
        logger.error(`Failed to fetch branches for repo ${owner}/${repo}.`, e);
        return [];
    }
}

const getReposOwnedByUsers = async <T>(users: string[], api: Api<T>) => {
    const repos = (await Promise.all(users.map(async (user) => {
        try {
            logger.debug(`Fetching repos for user ${user}...`);

            const { durationMs, data } = await measure(() =>
                paginate((page) => api.users.userListRepos(user, {
                    page,
                }))
            );

            logger.debug(`Found ${data.length} repos owned by user ${user} in ${durationMs}ms.`);
            return data;
        } catch (e) {
            logger.error(`Failed to fetch repos for user ${user}.`, e);
            return [];
        }
    }))).flat();

    return repos;
}

const getReposForOrgs = async <T>(orgs: string[], api: Api<T>) => {
    return (await Promise.all(orgs.map(async (org) => {
        try {
            logger.debug(`Fetching repos for org ${org}...`);

            const { durationMs, data } = await measure(() =>
                paginate((page) => api.orgs.orgListRepos(org, {
                    limit: 100,
                    page,
                }))
            );

            logger.debug(`Found ${data.length} repos for org ${org} in ${durationMs}ms.`);
            return data;
        } catch (e) {
            logger.error(`Failed to fetch repos for org ${org}.`, e);
            return [];
        }
    }))).flat();
}

const getRepos = async <T>(repos: string[], api: Api<T>) => {
    return (await Promise.all(repos.map(async (repo) => {
        try {
            logger.debug(`Fetching repository info for ${repo}...`);

            const [owner, repoName] = repo.split('/');
            const { durationMs, data: response } = await measure(() =>
                api.repos.repoGet(owner, repoName),
            );

            logger.debug(`Found repo ${repo} in ${durationMs}ms.`);

            return [response.data];
        } catch (e) {
            logger.error(`Failed to fetch repository info for ${repo}.`, e);
            return [];
        }
    }))).flat();
}

// @see : https://docs.gitea.com/development/api-usage#pagination
const paginate = async <T>(request: (page: number) => Promise<HttpResponse<T[], any>>) => {
    let page = 1;
    const result = await request(page);
    const output: T[] = result.data;

    const totalCountString = result.headers.get('x-total-count');
    if (!totalCountString) {
        throw new Error("Header 'x-total-count' not found");
    }
    const totalCount = parseInt(totalCountString);

    while (output.length < totalCount) {
        page++;
        const result = await request(page);
        output.push(...result.data);
    }

    return output;
}