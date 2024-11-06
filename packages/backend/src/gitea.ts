import { Api, giteaApi, HttpResponse, Repository as GiteaRepository } from 'gitea-js';
import { GiteaConfig } from './schemas/v2.js';
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, getTokenFromConfig, marshalBool, measure } from './utils.js';
import { AppContext, GitRepository } from './types.js';
import fetch from 'cross-fetch';
import { createLogger } from './logger.js';
import path from 'path';

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
    
    return repos;
}

const getReposOwnedByUsers = async <T>(users: string[], api: Api<T>) => {
    const repos = (await Promise.all(users.map(async (user) => {
        logger.debug(`Fetching repos for user ${user}...`);

        const { durationMs, data } = await measure(() =>
            paginate((page) => api.users.userListRepos(user, {
                page,
            }))
        );

        logger.debug(`Found ${data.length} repos owned by user ${user} in ${durationMs}ms.`);
        return data;
    }))).flat();

    return repos;
}

const getReposForOrgs = async <T>(orgs: string[], api: Api<T>) => {
    return (await Promise.all(orgs.map(async (org) => {
        logger.debug(`Fetching repos for org ${org}...`);

        const { durationMs, data } = await measure(() =>
            paginate((page) => api.orgs.orgListRepos(org, {
                limit: 100,
                page,
            }))
        );

        logger.debug(`Found ${data.length} repos for org ${org} in ${durationMs}ms.`);
        return data;
    }))).flat();
}

const getRepos = async <T>(repos: string[], api: Api<T>) => {
    return Promise.all(repos.map(async (repo) => {
        logger.debug(`Fetching repository info for ${repo}...`);

        const [owner, repoName] = repo.split('/');
        const { durationMs, data: response } = await measure(() =>
            api.repos.repoGet(owner, repoName),
        );

        logger.debug(`Found repo ${repo} in ${durationMs}ms.`);

        return response.data;
    }));
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