import { Api, giteaApi, HttpResponse, Repository as GiteaRepository } from 'gitea-js';
import { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import { getTokenFromConfig, measure } from './utils.js';
import fetch from 'cross-fetch';
import { createLogger } from '@sourcebot/logger';
import micromatch from 'micromatch';
import { PrismaClient } from '@sourcebot/db';
import { processPromiseResults, throwIfAnyFailed } from './connectionUtils.js';
import * as Sentry from "@sentry/node";
import { env } from './env.js';

const logger = createLogger('gitea');
const GITEA_CLOUD_HOSTNAME = "gitea.com";

export const getGiteaReposFromConfig = async (config: GiteaConnectionConfig, orgId: number, db: PrismaClient) => {
    const hostname = config.url ?
        new URL(config.url).hostname :
        GITEA_CLOUD_HOSTNAME;

    const token = config.token ?
        await getTokenFromConfig(config.token, orgId, db, logger) :
        hostname === GITEA_CLOUD_HOSTNAME ?
        env.FALLBACK_GITEA_CLOUD_TOKEN :
        undefined;

    const api = giteaApi(config.url ?? 'https://gitea.com', {
        token: token,
        customFetch: fetch,
    });

    let allRepos: GiteaRepository[] = [];
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
        const { validRepos, notFoundOrgs } = await getReposForOrgs(config.orgs, api);
        allRepos = allRepos.concat(validRepos);
        notFound.orgs = notFoundOrgs;
    }

    if (config.repos) {
        const { validRepos, notFoundRepos } = await getRepos(config.repos, api);
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFoundRepos;
    }

    if (config.users) {
        const { validRepos, notFoundUsers } = await getReposOwnedByUsers(config.users, api);
        allRepos = allRepos.concat(validRepos);
        notFound.users = notFoundUsers;
    }
    
    allRepos = allRepos.filter(repo => repo.full_name !== undefined);
    allRepos = allRepos.filter(repo => {
        if (repo.full_name === undefined) {
            logger.warn(`Repository with undefined full_name found: orgId=${orgId}, repoId=${repo.id}`);
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
        validRepos: repos,
        notFound,
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
                logger.error(`User ${user} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: user
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundUsers } = processPromiseResults<GiteaRepository>(results);

    return {
        validRepos,
        notFoundUsers,
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
                logger.error(`Organization ${org} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: org
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundOrgs } = processPromiseResults<GiteaRepository>(results);

    return {
        validRepos,
        notFoundOrgs,
    };
}

const getRepos = async <T>(repos: string[], api: Api<T>) => {
    const results = await Promise.allSettled(repos.map(async (repo) => {
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
                logger.error(`Repository ${repo} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: repo
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundRepos } = processPromiseResults<GiteaRepository>(results);

    return {
        validRepos,
        notFoundRepos,
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