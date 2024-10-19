import { Api, giteaApi, HttpResponse, Repository as GiteaRepository } from 'gitea-js';
import { GiteaConfig } from './schemas/v2.js';
import { getTokenFromConfig, marshalBool, measure } from './utils.js';
import { AppContext, Repository } from './types.js';
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

    let repos: Repository[] = allRepos
        .map((repo) => {
            const hostname = config.url ? new URL(config.url).hostname : 'gitea.com';
            const repoId = `${hostname}/${repo.full_name!}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`));

            const cloneUrl = new URL(repo.clone_url!);
            if (token) {
                cloneUrl.username = token;
            }

            return {
                name: repo.name!,
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
                    'zoekt.public': marshalBool(repo.private === false),
                }
            } satisfies Repository;
        });
    
    return repos;
}

const getReposForOrgs = async <T>(orgs: string[], api: Api<T>) => {
    const repos = (await Promise.all(orgs.map(async (org) => {
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

    return repos;
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