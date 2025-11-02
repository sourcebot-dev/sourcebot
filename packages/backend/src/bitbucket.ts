import { createBitbucketCloudClient } from "@coderabbitai/bitbucket/cloud";
import { createBitbucketServerClient } from "@coderabbitai/bitbucket/server";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/bitbucket.type";
import type { ClientOptions, ClientPathsWithMethod } from "openapi-fetch";
import { createLogger } from "@sourcebot/shared";
import { measure, fetchWithRetry } from "./utils.js";
import * as Sentry from "@sentry/node";
import {
    SchemaRepository as CloudRepository,
} from "@coderabbitai/bitbucket/cloud/openapi";
import { SchemaRestRepository as ServerRepository } from "@coderabbitai/bitbucket/server/openapi";
import { processPromiseResults } from "./connectionUtils.js";
import { throwIfAnyFailed } from "./connectionUtils.js";
import { getTokenFromConfig } from "@sourcebot/crypto";

const logger = createLogger('bitbucket');
const BITBUCKET_CLOUD_GIT = 'https://bitbucket.org';
const BITBUCKET_CLOUD_API = 'https://api.bitbucket.org/2.0';
const BITBUCKET_CLOUD = "cloud";
const BITBUCKET_SERVER = "server";

export type BitbucketRepository = CloudRepository | ServerRepository;

interface BitbucketClient {
    deploymentType: string;
    token: string | undefined;
    apiClient: any;
    baseUrl: string;
    gitUrl: string;
    getReposForWorkspace: (client: BitbucketClient, workspaces: string[]) => Promise<{repos: BitbucketRepository[], warnings: string[]}>;
    getReposForProjects: (client: BitbucketClient, projects: string[]) => Promise<{repos: BitbucketRepository[], warnings: string[]}>;
    getRepos: (client: BitbucketClient, repos: string[]) => Promise<{repos: BitbucketRepository[], warnings: string[]}>;
    shouldExcludeRepo: (repo: BitbucketRepository, config: BitbucketConnectionConfig) => boolean;
}

type CloudAPI = ReturnType<typeof createBitbucketCloudClient>;
type CloudGetRequestPath = ClientPathsWithMethod<CloudAPI, "get">;

type ServerAPI = ReturnType<typeof createBitbucketServerClient>;
type ServerGetRequestPath = ClientPathsWithMethod<ServerAPI, "get">;

type CloudPaginatedResponse<T> = {
    readonly next?: string;
    readonly page?: number;
    readonly pagelen?: number;
    readonly previous?: string;
    readonly size?: number;
    readonly values?: readonly T[];
}

type ServerPaginatedResponse<T> = {
    readonly size: number;
    readonly limit: number;
    readonly isLastPage: boolean;
    readonly values: readonly T[];
    readonly start: number;
    readonly nextPageStart: number;
}

export const getBitbucketReposFromConfig = async (config: BitbucketConnectionConfig) => {
    const token = config.token ?
        await getTokenFromConfig(config.token) :
        undefined;

    if (config.deploymentType === 'server' && !config.url) {
        throw new Error('URL is required for Bitbucket Server');
    }

    const client = config.deploymentType === 'server' ? 
        serverClient(config.url!, config.user, token) : 
        cloudClient(config.user, token);

    let allRepos: BitbucketRepository[] = [];
    let allWarnings: string[] = [];

    if (config.workspaces) {
        const { repos, warnings } = await client.getReposForWorkspace(client, config.workspaces);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.projects) {
        const { repos, warnings } = await client.getReposForProjects(client, config.projects);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.repos) {
        const { repos, warnings } = await client.getRepos(client, config.repos);
        allRepos = allRepos.concat(repos);
        allWarnings = allWarnings.concat(warnings);
    }

    const filteredRepos = allRepos.filter((repo) => {
        return !client.shouldExcludeRepo(repo, config);
    });

    return {
        repos: filteredRepos,
        warnings: allWarnings,
    };
}

function cloudClient(user: string | undefined, token: string | undefined): BitbucketClient {

    const authorizationString = 
        token
        ? !user || user == "x-token-auth"
            ? `Bearer ${token}`
            : `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`
        : undefined;

    const clientOptions: ClientOptions = {
        baseUrl: BITBUCKET_CLOUD_API,
        headers: {
            Accept: "application/json",
            ...(authorizationString ? { Authorization: authorizationString } : {}),
        },
    };

    const apiClient = createBitbucketCloudClient(clientOptions);
    var client: BitbucketClient = {
        deploymentType: BITBUCKET_CLOUD,
        token: token,
        apiClient: apiClient,
        baseUrl: BITBUCKET_CLOUD_API,
        gitUrl: BITBUCKET_CLOUD_GIT,
        getReposForWorkspace: cloudGetReposForWorkspace,
        getReposForProjects: cloudGetReposForProjects,
        getRepos: cloudGetRepos,
        shouldExcludeRepo: cloudShouldExcludeRepo,
    }

    return client;
}

/**
* We need to do `V extends CloudGetRequestPath` since we will need to call `apiClient.GET(url, ...)`, which
* expects `url` to be of type `CloudGetRequestPath`. See example.
**/
const getPaginatedCloud = async <T>(
    path: CloudGetRequestPath,
    get: (path: CloudGetRequestPath, query?: Record<string, string>) => Promise<CloudPaginatedResponse<T>>
): Promise<T[]> => {
    const results: T[] = [];
    let nextPath = path;
    let nextQuery = undefined;

    while (true) {
        const response = await get(nextPath, nextQuery);

        if (!response.values || response.values.length === 0) { 
            break;
        }

        results.push(...response.values);

        if (!response.next) {
            break;
        }

        const parsedUrl = parseUrl(response.next);
        nextPath = parsedUrl.path as CloudGetRequestPath;
        nextQuery = parsedUrl.query;
    }
    return results;
}

/**
 * Parse the url into a path and query parameters to be used with the api client (openapi-fetch)
 */
function parseUrl(url: string): { path: string; query: Record<string, string>; } {
    const fullUrl = new URL(url);
    const path = fullUrl.pathname.replace(/^\/\d+(\.\d+)*/, ''); // remove version number in the beginning of the path
    const query = Object.fromEntries(fullUrl.searchParams);
    logger.debug(`Parsed url ${url} into path ${path} and query ${JSON.stringify(query)}`);
    return { path, query };
}


async function cloudGetReposForWorkspace(client: BitbucketClient, workspaces: string[]): Promise<{repos: CloudRepository[], warnings: string[]}> {
    const results = await Promise.allSettled(workspaces.map(async (workspace) => {
        try {
            logger.debug(`Fetching all repos for workspace ${workspace}...`);

            const { durationMs, data } = await measure(async () => {
                const fetchFn = () => getPaginatedCloud<CloudRepository>(`/repositories/${workspace}` as CloudGetRequestPath, async (path, query) => {
                    const response = await client.apiClient.GET(path, {
                        params: {
                            path: {
                                workspace,
                            },
                            query: query,
                        }
                    });
                    const { data, error } = response;
                    if (error) {
                        throw new Error(`Failed to fetch projects for workspace ${workspace}: ${JSON.stringify(error)}`);
                    }
                    return data;
                });
                return fetchWithRetry(fetchFn, `workspace ${workspace}`, logger);
            });
            logger.debug(`Found ${data.length} repos for workspace ${workspace} in ${durationMs}ms.`);

            return {
                type: 'valid' as const,
                data: data,
            };
        } catch (e: any) {
            Sentry.captureException(e);
            logger.error(`Failed to get repos for workspace ${workspace}: ${e}`);

            const status = e?.cause?.response?.status;
            if (status == 404) {
                const warning = `Workspace ${workspace} not found or invalid access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                }
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults(results);
    return {
        repos,
        warnings,
    };
}

async function cloudGetReposForProjects(client: BitbucketClient, projects: string[]): Promise<{repos: CloudRepository[], warnings: string[]}> {
    const results = await Promise.allSettled(projects.map(async (project) => {
        const [workspace, project_name] = project.split('/');
        if (!workspace || !project_name) {
            const warning = `Invalid project ${project}`;
            logger.warn(warning);
            return {
                type: 'warning' as const,
                warning
            }
        }

        logger.debug(`Fetching all repos for project ${project} for workspace ${workspace}...`);
        try {
            const repos = await getPaginatedCloud<CloudRepository>(`/repositories/${workspace}` as CloudGetRequestPath, async (path, query) => {
                const response = await client.apiClient.GET(path, {
                    params: {
                        path: {
                            workspace,
                        },
                        query: {
                            ...query,
                            q: `project.key="${project_name}"`
                        }
                    }
                });
                const { data, error } = response;
                if (error) {
                    throw new Error (`Failed to fetch projects for workspace ${workspace}: ${error.type}`);
                }
                return data;
            });

            logger.debug(`Found ${repos.length} repos for project ${project_name} for workspace ${workspace}.`);
            return {
                type: 'valid' as const,
                data: repos
            }
        } catch (e: any) {
            Sentry.captureException(e);
            logger.error(`Failed to fetch repos for project ${project_name}: ${e}`);

            const status = e?.cause?.response?.status;
            if (status == 404) {
                const warning = `Project ${project_name} not found in ${workspace} or invalid access`;
                logger.warn(warning);
                return {
                    type: 'warning' as const,
                    warning
                }
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: repos, warnings } = processPromiseResults(results);
    return {
        repos,
        warnings
    }
}

async function cloudGetRepos(client: BitbucketClient, repoList: string[]): Promise<{repos: CloudRepository[], warnings: string[]}> {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        const [workspace, repo_slug] = repo.split('/');
        if (!workspace || !repo_slug) {
            const warning = `Invalid repo ${repo}`;
            logger.warn(warning);
            return {
                type: 'warning' as const,
                warning
            };
        }

        logger.debug(`Fetching repo ${repo_slug} for workspace ${workspace}...`);
        try {
            const path = `/repositories/${workspace}/${repo_slug}` as CloudGetRequestPath;
            const response = await client.apiClient.GET(path);
            const { data, error } = response;
            if (error) {
                throw new Error(`Failed to fetch repo ${repo}: ${error.type}`);
            }
            return {
                type: 'valid' as const,
                data: [data]
            };
        } catch (e: any) {
            Sentry.captureException(e);
            logger.error(`Failed to fetch repo ${repo}: ${e}`);

            const status = e?.cause?.response?.status;
            if (status === 404) {
                const warning = `Repo ${repo} not found in ${workspace} or invalid access`;
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
    const { validItems: repos, warnings } = processPromiseResults(results);
    return {
        repos,
        warnings
    };
}

function cloudShouldExcludeRepo(repo: BitbucketRepository, config: BitbucketConnectionConfig): boolean {
    const cloudRepo = repo as CloudRepository;
    
    const shouldExclude = (() => {
        if (config.exclude?.repos && config.exclude.repos.includes(cloudRepo.full_name!)) {
            return true;
        }

        if (!!config.exclude?.archived) {
            logger.warn(`Exclude archived repos flag provided in config but Bitbucket Cloud does not support archived repos. Ignoring...`);
        }

        if (!!config.exclude?.forks && cloudRepo.parent !== undefined) {
            return true;
        }
    })();

    if (shouldExclude) {
        logger.debug(`Excluding repo ${cloudRepo.full_name} because it matches the exclude pattern`);
        return true;
    }
    return false;
}

function serverClient(url: string, user: string | undefined, token: string | undefined): BitbucketClient {
    const authorizationString = (() => {
        // If we're not given any credentials we return an empty auth string. This will only work if the project/repos are public
        if(!user && !token) {
            return "";
        }

        // A user must be provided when using basic auth
        // https://developer.atlassian.com/server/bitbucket/rest/v906/intro/#authentication
        if (!user || user == "x-token-auth") {
            return `Bearer ${token}`;
        }
        return `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
    })();
    const clientOptions: ClientOptions = {
        baseUrl: url,
        headers: {
            Accept: "application/json",
            Authorization: authorizationString,
        },
    };

    const apiClient = createBitbucketServerClient(clientOptions);
    var client: BitbucketClient = {
        deploymentType: BITBUCKET_SERVER,
        token: token,
        apiClient: apiClient,
        baseUrl: url,
        gitUrl: url,
        getReposForWorkspace: serverGetReposForWorkspace,
        getReposForProjects: serverGetReposForProjects,
        getRepos: serverGetRepos,
        shouldExcludeRepo: serverShouldExcludeRepo,
    }

    return client;
}

const getPaginatedServer = async <T>(
    path: ServerGetRequestPath,
    get: (url: ServerGetRequestPath, start?: number) => Promise<ServerPaginatedResponse<T>>
): Promise<T[]> => {
    const results: T[] = [];
    let nextStart: number | undefined;

    while (true) {
        const response = await get(path, nextStart);

        if (!response.values || response.values.length === 0) { 
            break;
        }

        results.push(...response.values);

        if (response.isLastPage) {
            break;
        }

        nextStart = response.nextPageStart;
    }
    return results;
}

async function serverGetReposForWorkspace(client: BitbucketClient, workspaces: string[]): Promise<{repos: ServerRepository[], warnings: string[]}> {
    const warnings = workspaces.map(workspace => `Workspaces are not supported in Bitbucket Server: ${workspace}`);
    logger.debug('Workspaces are not supported in Bitbucket Server');
    return {
        repos: [],
        warnings
    };
}

async function serverGetReposForProjects(client: BitbucketClient, projects: string[]): Promise<{repos: ServerRepository[], warnings: string[]}> {
    const results = await Promise.allSettled(projects.map(async (project) => {
        try {
            logger.debug(`Fetching all repos for project ${project}...`);

            const path = `/rest/api/1.0/projects/${project}/repos` as ServerGetRequestPath;
            const { durationMs, data } = await measure(async () => {
                const fetchFn = () => getPaginatedServer<ServerRepository>(path, async (url, start) => {
                    const response = await client.apiClient.GET(url, {
                        params: {
                            query: {
                                start,
                            }
                        }
                    });
                    const { data, error } = response;
                    if (error) {
                        throw new Error(`Failed to fetch repos for project ${project}: ${JSON.stringify(error)}`);
                    }
                    return data;
                });
                return fetchWithRetry(fetchFn, `project ${project}`, logger);
            });
            logger.debug(`Found ${data.length} repos for project ${project} in ${durationMs}ms.`);

            return {
                type: 'valid' as const,
                data: data,
            };
        } catch (e: any) {
            Sentry.captureException(e);
            logger.error(`Failed to get repos for project ${project}: ${e}`);

            const status = e?.cause?.response?.status;
            if (status == 404) {
                const warning = `Project ${project} not found or invalid access`;
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
    const { validItems: repos, warnings } = processPromiseResults(results);
    return {
        repos,
        warnings
    };
}

async function serverGetRepos(client: BitbucketClient, repoList: string[]): Promise<{repos: ServerRepository[], warnings: string[]}> {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        const [project, repo_slug] = repo.split('/');
        if (!project || !repo_slug) {
            const warning = `Invalid repo ${repo}`;
            logger.warn(warning);
            return {
                type: 'warning' as const,
                warning
            };
        }

        logger.debug(`Fetching repo ${repo_slug} for project ${project}...`);
        try {
            const path = `/rest/api/1.0/projects/${project}/repos/${repo_slug}` as ServerGetRequestPath;
            const response = await client.apiClient.GET(path);
            const { data, error } = response;
            if (error) {
                throw new Error(`Failed to fetch repo ${repo}: ${error.type}`);
            }
            return {
                type: 'valid' as const,
                data: [data]
            };
        } catch (e: any) {
            Sentry.captureException(e);
            logger.error(`Failed to fetch repo ${repo}: ${e}`);

            const status = e?.cause?.response?.status;
            if (status === 404) {
                const warning = `Repo ${repo} not found in project ${project} or invalid access`;
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
    const { validItems: repos, warnings } = processPromiseResults(results);
    return {
        repos,
        warnings
    };
}

function serverShouldExcludeRepo(repo: BitbucketRepository, config: BitbucketConnectionConfig): boolean {
    const serverRepo = repo as ServerRepository;

    const projectName = serverRepo.project!.key;
    const repoSlug = serverRepo.slug!;
    
    const shouldExclude = (() => {
        if (config.exclude?.repos && config.exclude.repos.includes(`${projectName}/${repoSlug}`)) {
            return true;
        }

        if (!!config.exclude?.archived && serverRepo.archived) {
            return true;
        }

        if (!!config.exclude?.forks && serverRepo.origin !== undefined) {
            return true;
        }
    })();

    if (shouldExclude) {
        logger.debug(`Excluding repo ${projectName}/${repoSlug} because it matches the exclude pattern`);
        return true;
    }
    return false;
}