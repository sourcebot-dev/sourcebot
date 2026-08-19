import * as Sentry from "@sentry/node";
import { getTokenFromConfig } from "@sourcebot/shared";
import { createLogger } from '@sourcebot/shared';
import { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import { env } from "@sourcebot/shared";
import fetch from 'cross-fetch';
import { Api, giteaApi, Repository as GiteaRepository, HttpResponse } from 'gitea-js';
import micromatch from 'micromatch';
import { processPromiseResults, throwIfAnyFailed } from './connectionUtils.js';
import { reportRepositoryDiscoveryIssue } from './repositoryDiscoveryIssueContext.js';
import { measure } from './utils.js';

const logger = createLogger('gitea');
const GITEA_CLOUD_HOSTNAME = "gitea.com";

// Some Gitea instances (particularly when behind certain reverse proxies or with
// response compression enabled) cause `cross-fetch` to fail while reading the
// response body with ERR_STREAM_PREMATURE_CLOSE. Forcing identity encoding and
// closing the connection avoids the premature close.
// @see https://github.com/sourcebot-dev/sourcebot/issues/1404
const customFetch: typeof fetch = (url, options = {}) => {
    return fetch(url, {
        ...options,
        headers: {
            ...(options.headers ?? {}),
            'Accept-Encoding': 'identity',
            'Connection': 'close',
        },
    });
};

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
        customFetch,
    });

    let allRepos: GiteaRepository[] = [];

    if (config.orgs) {
        allRepos = allRepos.concat(await getReposForOrgs(config.orgs, api));
    }

    if (config.repos) {
        allRepos = allRepos.concat(await getRepos(config.repos, api));
    }

    if (config.users) {
        allRepos = allRepos.concat(await getReposOwnedByUsers(config.users, api));
    }
    
    allRepos = allRepos.filter(repo => {
        if (repo === null || repo === undefined) {
            logger.warn(`Skipping null/undefined repository returned by the Gitea API`);
            reportRepositoryDiscoveryIssue({
                code: "INVALID_PROVIDER_RESPONSE",
                effect: "DISCOVERY_INCOMPLETE",
                message: "Gitea returned a null repository, so it was skipped.",
            });
            return false;
        }
        if (repo.full_name === undefined) {
            logger.warn(`Repository with undefined full_name found: repoId=${repo.id}`);
            reportRepositoryDiscoveryIssue({
                code: "INVALID_PROVIDER_RESPONSE",
                effect: "DISCOVERY_INCOMPLETE",
                ...(repo.id !== undefined && repo.id !== null ? {
                    subject: {
                        kind: "repository" as const,
                        value: String(repo.id),
                    },
                } : {}),
                message: "Gitea returned a repository without a full name, so it was skipped.",
            });
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
            return data;
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `User ${user} not found or no access`;
                logger.warn(warning);
                reportRepositoryDiscoveryIssue({
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "user",
                        value: user,
                    },
                    message: "Gitea user was not found or is inaccessible.",
                });
                return [];
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    return processPromiseResults(results);
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
            return data;
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `Organization ${org} not found or no access`;
                logger.warn(warning);
                reportRepositoryDiscoveryIssue({
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "organization",
                        value: org,
                    },
                    message: "Gitea organization was not found or is inaccessible.",
                });
                return [];
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    return processPromiseResults(results);
}

const getRepos = async <T>(repoList: string[], api: Api<T>) => {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        try {
            logger.debug(`Fetching repository info for ${repo}...`);

            const [owner, repoName] = repo.split('/');
            const { durationMs, data: response } = await measure(() =>
                api.repos.repoGet(owner, repoName),
            );

            if (response.error || !response.data) {
                throw response.error ?? new Error(`Received empty response body while fetching repository ${repo}`);
            }

            logger.debug(`Found repo ${repo} in ${durationMs}ms.`);
            return [response.data];
        } catch (e: any) {
            Sentry.captureException(e);

            if (e?.status === 404) {
                const warning = `Repository ${repo} not found or no access`;
                logger.warn(warning);
                reportRepositoryDiscoveryIssue({
                    code: "NOT_FOUND_OR_INACCESSIBLE",
                    effect: "TARGET_SKIPPED",
                    subject: {
                        kind: "repository",
                        value: repo,
                    },
                    message: "Gitea repository was not found or is inaccessible.",
                });
                return [];
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    return processPromiseResults(results);
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
        if (result.data.length === 0) {
            break;
        }
        output.push(...result.data);
    }

    return output;
}
