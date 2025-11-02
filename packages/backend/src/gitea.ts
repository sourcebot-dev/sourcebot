import * as Sentry from "@sentry/node";
import { getTokenFromConfig } from "@sourcebot/crypto";
import { createLogger } from '@sourcebot/shared';
import { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import { env } from "@sourcebot/shared";
import fetch from 'cross-fetch';
import { Api, giteaApi, Repository as GiteaRepository, HttpResponse } from 'gitea-js';
import micromatch from 'micromatch';
import { processPromiseResults, throwIfAnyFailed } from './connectionUtils.js';
import { measure } from './utils.js';

const logger = createLogger('gitea');
const GITEA_CLOUD_HOSTNAME = "gitea.com";

export const getGiteaReposFromConfig = async (config: GiteaConnectionConfig) => {
    const hostname = config.url ?
        new URL(config.url).hostname :
        GITEA_CLOUD_HOSTNAME;

    const token = config.token ?
        await getTokenFromConfig(config.token) :
        hostname === GITEA_CLOUD_HOSTNAME ?
        env.FALLBACK_GITEA_CLOUD_TOKEN :
        undefined;

    const api = giteaApi(config.url ?? 'https://gitea.com', {
        token: token,
        customFetch: fetch,
    });

    let allRepos: GiteaRepository[] = [];
    let allWarnings: string[] = [];

    if (config.orgs) {
        const { repos, warnings } = await getReposForOrgs(config.orgs, api);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.repos) {
        const { repos, warnings } = await getRepos(config.repos, api);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.users) {
        const { repos, warnings } = await getReposOwnedByUsers(config.users, api);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }
    
    allRepos = allRepos.filter(repo => repo.full_name !== undefined);
    allRepos = allRepos.filter(repo => {
        if (repo.full_name === undefined) {
            logger.warn(`Repository with undefined full_name found: repoId=${repo.id}`);
            return false;
        }
        return true;
    });

    let repos = allRepos
        .filter((repo) => {
            const isExcluded = shouldExcludeRepo({
                repo,
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

const getReposOwnedByUsers = async <T>(users: string[], api: Api<T>) => {
    const results = await Promise.allSettled(users.map(async (user) => {
        try {
            logger.debug(`Fetching repos for user ${user}...`);

            const { durationMs, data } = await measure(() =>
                paginate((page) => api.users.userListRepos(user, {
                    page,
                }))
            );

            logger.debug(`Found ${data.length} repos owned by user ${user} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `User ${user} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<GiteaRepository>(results);

    return {
        repos,
        warnings,
    };
}

const getReposForOrgs = async <T>(orgs: string[], api: Api<T>) => {
    const results = await Promise.allSettled(orgs.map(async (org) => {
        try {
            logger.debug(`Fetching repos for org ${org}...`);

            const { durationMs, data } = await measure(() =>
                paginate((page) => api.orgs.orgListRepos(org, {
                    limit: 100,
                    page,
                }))
            );

            logger.debug(`Found ${data.length} repos for org ${org} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `Organization ${org} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<GiteaRepository>(results);

    return {
        repos,
        warnings,
    };
}

const getRepos = async <T>(repoList: string[], api: Api<T>) => {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        try {
            logger.debug(`Fetching repository info for ${repo}...`);

            const [owner, repoName] = repo.split('/');
            const { durationMs, data: response } = await measure(() =>
                api.repos.repoGet(owner, repoName),
            );

            logger.debug(`Found repo ${repo} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data: [response.data]
            };
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `Repository ${repo} not found or no access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults<GiteaRepository>(results);

    return {
        repos,
        warnings,
    };
}

// @see : https://docs.gitea.com/development/api-usage#pagination
const paginate = async <T>(request: (page: number) => Promise<HttpResponse<T[], any>>) => {
    let page = 1;
    const result = await request(page);
    const output: T[] = result.data;

    const totalCountString = result.headers.get('x-total-count');
    if (!totalCountString) {
        const e = new Error("Header 'x-total-count' not found");
        Sentry.captureException(e);
        throw e;
    }
    const totalCount = parseInt(totalCountString);

    while (output.length < totalCount) {
        page++;
        const result = await request(page);
        output.push(...result.data);
    }

    return output;
}