import { Api, giteaApi, HttpResponse, Repository as GiteaRepository } from 'gitea-js';
import { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import { getTokenFromConfig, measure, fetchWithRetry } from './utils.js';
import fetch from 'cross-fetch';
import { createLogger } from './logger.js';
import micromatch from 'micromatch';
import { PrismaClient } from '@sourcebot/db';
import { FALLBACK_GITEA_TOKEN } from './environment.js';
const logger = createLogger('Gitea');

export const getGiteaReposFromConfig = async (config: GiteaConnectionConfig, orgId: number, db: PrismaClient) => {
    const token = config.token ? await getTokenFromConfig(config.token, orgId, db) : undefined;

    const api = giteaApi(config.url ?? 'https://gitea.com', {
        token: token ?? FALLBACK_GITEA_TOKEN,
        customFetch: fetch,
    });

    let allRepos: GiteaRepository[] = [];

    if (config.orgs) {
        const _repos = await fetchWithRetry(
            () => getReposForOrgs(config.orgs!, api),
            `orgs ${config.orgs.join(', ')}`,
            logger
        );
        allRepos = allRepos.concat(_repos);
    }

    if (config.repos) {
        const _repos = await fetchWithRetry(
            () => getRepos(config.repos!, api),
            `repos ${config.repos.join(', ')}`,
            logger
        );
        allRepos = allRepos.concat(_repos);
    }

    if (config.users) {
        const _repos = await fetchWithRetry(
            () => getReposOwnedByUsers(config.users!, api),
            `users ${config.users.join(', ')}`,
            logger
        );
        allRepos = allRepos.concat(_repos);
    }
    
    allRepos = allRepos.filter(repo => repo.full_name !== undefined);
    allRepos = allRepos.filter(repo => {
        if (repo.full_name === undefined) {
            logger.warn(`Repository with undefined full_name found: orgId=${orgId}, repoId=${repo.id}`);
            return false;
        }
        return true;
    });

    
    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            allRepos = await Promise.all(
                allRepos.map(async (repo) => {
                    const [owner, name] = repo.full_name!.split('/');
                    let branches = (await fetchWithRetry(
                        () => getBranchesForRepo(owner, name, api),
                        `branches for ${owner}/${name}`,
                        logger
                    )).map(branch => branch.name!);
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
            allRepos = await Promise.all(
                allRepos.map(async (allRepos) => {
                    const [owner, name] = allRepos.name!.split('/');
                    let tags = (await fetchWithRetry(
                        () => getTagsForRepo(owner, name, api),
                        `tags for ${owner}/${name}`,
                        logger
                    )).map(tag => tag.name!);
                    tags = micromatch.match(tags, tagGlobs);
                    
                    return {
                        ...allRepos,
                        tags,
                    };
                })
            )
        }
    }

    let repos = allRepos
        .filter((repo) => {
            const isExcluded = shouldExcludeRepo({
                repo,
                exclude: config.exclude,
            });

            return !isExcluded;
        });
    
    logger.debug(`Found ${repos.length} total repositories.`);
    return repos;
}

const shouldExcludeRepo = ({
    repo,
    exclude
} : {
    repo: GiteaRepository,
    exclude?: {
        forks?: boolean,
        archived?: boolean,
        repos?: string[],
    }
}) => {
    let reason = '';
    const repoName = repo.full_name!;

    const shouldExclude = (() => {
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

        return false;
    })();

    if (shouldExclude) {
        logger.debug(`Excluding repo ${repoName}. Reason: ${reason}`);
    }

    return shouldExclude;
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