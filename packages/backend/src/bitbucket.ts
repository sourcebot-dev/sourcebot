import { createBitbucketCloudClient } from "@coderabbitai/bitbucket/cloud";
import { paths } from "@coderabbitai/bitbucket/cloud";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/bitbucket.type";
import type { ClientOptions, Client, ClientPathsWithMethod } from "openapi-fetch";
import { createLogger } from "./logger.js";
import { PrismaClient, Repo } from "@sourcebot/db";
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import { env } from "./env.js";
import * as Sentry from "@sentry/node";
import {
    SchemaBranch as CloudBranch,
    SchemaProject as CloudProject,
    SchemaRepository as CloudRepository,
    SchemaTag as CloudTag,
    SchemaWorkspace as CloudWorkspace
} from "@coderabbitai/bitbucket/cloud/openapi";
import { SchemaRepository as ServerRepository } from "@coderabbitai/bitbucket/server/openapi";
import { processPromiseResults } from "./connectionUtils.js";
import { throwIfAnyFailed } from "./connectionUtils.js";

const logger = createLogger("Bitbucket");
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
    getPaginated: <T, V extends CloudGetRequestPath>(path: V, get: (url: V) => Promise<PaginatedResponse<T>>) => Promise<T[]>;
    getReposForWorkspace: (client: BitbucketClient, workspace: string) => Promise<{validRepos: BitbucketRepository[], notFoundWorkspaces: string[]}>;
    getReposForProjects: (client: BitbucketClient, projects: string[]) => Promise<{validRepos: BitbucketRepository[], notFoundProjects: string[]}>;
    getRepos: (client: BitbucketClient, repos: string[]) => Promise<{validRepos: BitbucketRepository[], notFoundRepos: string[]}>;
    /*
    countForks: (client: BitbucketClient, repo: Repo) => Promise<number>;
    countWatchers: (client: BitbucketClient, repo: Repo) => Promise<number>;
    getBranches: (client: BitbucketClient, repo: string) => Promise<string[]>;
    getTags: (client: BitbucketClient, repo: string) => Promise<string[]>;
    */
}

// afaik, this is the only way of extracting the client API type
type CloudAPI = ReturnType<typeof createBitbucketCloudClient>;

// Defines a type that is a union of all API paths that have a GET method in the
// client api.
type CloudGetRequestPath = ClientPathsWithMethod<CloudAPI, "get">;

type PaginatedResponse<T> = {
    readonly next?: string;
    readonly page?: number;
    readonly pagelen?: number;
    readonly previous?: string;
    readonly size?: number;
    readonly values?: readonly T[];
}

export const getBitbucketReposFromConfig = async (config: BitbucketConnectionConfig, orgId: number, db: PrismaClient) => {
    const token = await getTokenFromConfig(config.token, orgId, db, logger);

    //const deploymentType = config.deploymentType;
    const client = cloudClient(config.user, token);

    let allRepos: BitbucketRepository[] = [];
    let notFound: {
        orgs: string[],
        users: string[],
        repos: string[],
    } = {
        orgs: [],
        users: [],
        repos: [],
    };

    if (config.workspace) {
        const { validRepos, notFoundWorkspaces } = await client.getReposForWorkspace(client, config.workspace);
        allRepos = allRepos.concat(validRepos);
        notFound.orgs = notFoundWorkspaces;
    }

    if (config.projects) {
        const { validRepos, notFoundProjects } = await client.getReposForProjects(client, config.projects);
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFoundProjects;
    }

    if (config.repos) {
        const { validRepos, notFoundRepos } = await client.getRepos(client, config.repos);
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFoundRepos;
    }

    return {
        validRepos: allRepos,
        notFound,
    };
}

function cloudClient(user: string | undefined, token: string | undefined): BitbucketClient {

    const authorizationString = !user || user == "x-token-auth" ? `Bearer ${token}` : `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;
    const clientOptions: ClientOptions = {
        baseUrl: BITBUCKET_CLOUD_API,
        headers: {
            Accept: "application/json",
            Authorization: authorizationString,
        },
    };

    const apiClient = createBitbucketCloudClient(clientOptions);
    var client: BitbucketClient = {
        deploymentType: BITBUCKET_CLOUD,
        token: token,
        apiClient: apiClient,
        baseUrl: BITBUCKET_CLOUD_API,
        gitUrl: BITBUCKET_CLOUD_GIT,
        getPaginated: getPaginatedCloud,
        getReposForWorkspace: cloudGetReposForWorkspace,
        getReposForProjects: cloudGetReposForProjects,
        getRepos: cloudGetRepos,
        /*
        getRepos: cloudGetRepos,
        countForks: cloudCountForks,
        countWatchers: cloudCountWatchers,
        getBranches: cloudGetBranches,
        getTags: cloudGetTags,
        */
    }

    return client;
}

/**
* We need to do `V extends CloudGetRequestPath` since we will need to call `apiClient.GET(url, ...)`, which
* expects `url` to be of type `CloudGetRequestPath`. See example.
**/
const getPaginatedCloud = async <T, V extends CloudGetRequestPath>(path: V, get: (url: V) => Promise<PaginatedResponse<T>>) => {
    const results: T[] = [];
    let url = path;

    while (true) {
        const response = await get(url);

        if (!response.values || response.values.length === 0) { 
            break;
        }

        results.push(...response.values);

        if (!response.next) {
            break;
        }

        // cast required here since response.next is a string.
        url = response.next as V;
    }
    return results;
}
   

async function cloudGetReposForWorkspace(client: BitbucketClient, workspace: string): Promise<{validRepos: CloudRepository[], notFoundWorkspaces: string[]}> {
    try {
        logger.debug(`Fetching all repos for workspace ${workspace}...`);

        const path = `/repositories/${workspace}` as CloudGetRequestPath;
        const { durationMs, data } = await measure(async () => {
            const fetchFn = () => client.getPaginated<CloudRepository, typeof path>(path, async (url) => {
                const response = await client.apiClient.GET(url, {
                    params: {
                        path: {
                            workspace,
                        }
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
            validRepos: data,
            notFoundWorkspaces: [],
        };
    } catch (e) {
        Sentry.captureException(e);
        logger.error(`Failed to get repos for workspace ${workspace}: ${e}`);
        throw e;
    }
}

async function cloudGetReposForProjects(client: BitbucketClient, projects: string[]): Promise<{validRepos: CloudRepository[], notFoundProjects: string[]}> {
    const results = await Promise.allSettled(projects.map(async (project) => {
        const [workspace, project_name] = project.split('/');
        if (!workspace || !project_name) {
            logger.error(`Invalid project ${project}`);
            return {
                type: 'notFound' as const,
                value: project
            }
        }

        logger.debug(`Fetching all repos for project ${project} for workspace ${workspace}...`);
        try {
            const path = `/repositories/${workspace}?q=project.key="${project_name}"` as CloudGetRequestPath;
            const repos = await client.getPaginated<CloudRepository, typeof path>(path, async (url) => {
                const response = await client.apiClient.GET(url);
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
                logger.error(`Project ${project_name} not found in ${workspace} or invalid access`)
                return {
                    type: 'notFound' as const,
                    value: project
                }
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundProjects } = processPromiseResults(results);
    return {
        validRepos,
        notFoundProjects
    }
}

async function cloudGetRepos(client: BitbucketClient, repos: string[]): Promise<{validRepos: CloudRepository[], notFoundRepos: string[]}> {
    const results = await Promise.allSettled(repos.map(async (repo) => {
        const [workspace, repo_slug] = repo.split('/');
        if (!workspace || !repo_slug) {
            logger.error(`Invalid repo ${repo}`);
            return {
                type: 'notFound' as const,
                value: repo
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
                logger.error(`Repo ${repo} not found in ${workspace} or invalid access`);
                return {
                    type: 'notFound' as const,
                    value: repo
                };
            }
            throw e;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundRepos } = processPromiseResults(results);
    return {
        validRepos,
        notFoundRepos
    };
}