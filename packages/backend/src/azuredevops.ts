import { AzureDevOpsConnectionConfig } from "@sourcebot/schemas/v3/azuredevops.type";
import { createLogger } from "@sourcebot/logger";
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import micromatch from "micromatch";
import { PrismaClient } from "@sourcebot/db";
import { BackendException, BackendError } from "@sourcebot/error";
import { processPromiseResults, throwIfAnyFailed } from "./connectionUtils.js";
import * as Sentry from "@sentry/node";
import * as azdev from "azure-devops-node-api";
import { GitRepository } from "azure-devops-node-api/interfaces/GitInterfaces.js";

const logger = createLogger('azuredevops');
const AZUREDEVOPS_CLOUD_HOSTNAME = "dev.azure.com";


function buildOrgUrl(baseUrl: string, org: string, useTfsPath: boolean): string {
    const tfsSegment = useTfsPath ? '/tfs' : '';
    return `${baseUrl}${tfsSegment}/${org}`;
}

function createAzureDevOpsConnection(
    orgUrl: string,
    token: string,
): azdev.WebApi {
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    return new azdev.WebApi(orgUrl, authHandler);
}

export const getAzureDevOpsReposFromConfig = async (
    config: AzureDevOpsConnectionConfig, 
    orgId: number, 
    db: PrismaClient
) => {
    const baseUrl = config.url || `https://${AZUREDEVOPS_CLOUD_HOSTNAME}`;

    const token = config.token ?
        await getTokenFromConfig(config.token, orgId, db, logger) :
        undefined;

    if (!token) {
        const e = new BackendException(BackendError.CONNECTION_SYNC_INVALID_TOKEN, {
            message: 'Azure DevOps requires a Personal Access Token',
        });
        Sentry.captureException(e);
        throw e;
    }

    const useTfsPath = config.useTfsPath || false;
    let allRepos: GitRepository[] = [];
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
        const { validRepos, notFoundOrgs } = await getReposForOrganizations(
            config.orgs, 
            baseUrl,
            token,
            useTfsPath
        );
        allRepos = allRepos.concat(validRepos);
        notFound.orgs = notFoundOrgs;
    }

    if (config.projects) {
        const { validRepos, notFoundProjects } = await getReposForProjects(
            config.projects,
            baseUrl,
            token,
            useTfsPath
        );
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFound.repos.concat(notFoundProjects);
    }

    if (config.repos) {
        const { validRepos, notFoundRepos } = await getRepos(
            config.repos,
            baseUrl,
            token,
            useTfsPath
        );
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFound.repos.concat(notFoundRepos);
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

    return {
        validRepos: repos,
        notFound,
    };
};

export const shouldExcludeRepo = ({
    repo,
    exclude
}: {
    repo: GitRepository,
    exclude?: AzureDevOpsConnectionConfig['exclude']
}) => {
    let reason = '';
    const repoName = `${repo.project!.name}/${repo.name}`;

    const shouldExclude = (() => {
        if (!repo.remoteUrl) {
            reason = 'remoteUrl is undefined';
            return true;
        }

        if (!!exclude?.disabled && repo.isDisabled) {
            reason = `\`exclude.disabled\` is true`;
            return true;
        }

        if (exclude?.repos) {
            if (micromatch.isMatch(repoName, exclude.repos)) {
                reason = `\`exclude.repos\` contains ${repoName}`;
                return true;
            }
        }

        if (exclude?.projects) {
            if (micromatch.isMatch(repo.project!.name!, exclude.projects)) {
                reason = `\`exclude.projects\` contains ${repo.project!.name}`;
                return true;
            }
        }

        const repoSizeInBytes = repo.size || 0;
        if (exclude?.size && repoSizeInBytes) {
            const min = exclude.size.min;
            const max = exclude.size.max;

            if (min && repoSizeInBytes < min) {
                reason = `repo is less than \`exclude.size.min\`=${min} bytes.`;
                return true;
            }

            if (max && repoSizeInBytes > max) {
                reason = `repo is greater than \`exclude.size.max\`=${max} bytes.`;
                return true;
            }
        }

        return false;
    })();

    if (shouldExclude) {
        logger.debug(`Excluding repo ${repoName}. Reason: ${reason}`);
        return true;
    }

    return false;
};

async function getReposForOrganizations(
    organizations: string[],
    baseUrl: string,
    token: string,
    useTfsPath: boolean
) {
    const results = await Promise.allSettled(organizations.map(async (org) => {
        try {
            logger.debug(`Fetching repositories for organization ${org}...`);
            
            const { durationMs, data } = await measure(async () => {
                const fetchFn = async () => {
                    const orgUrl = buildOrgUrl(baseUrl, org, useTfsPath);
                    const connection = createAzureDevOpsConnection(orgUrl, token); // useTfsPath already handled in orgUrl
                    
                    const coreApi = await connection.getCoreApi();
                    const gitApi = await connection.getGitApi();
                    
                    const projects = await coreApi.getProjects();
                    const allRepos: GitRepository[] = [];
                    for (const project of projects) {
                        if (!project.id) {
                            logger.warn(`Encountered project in org ${org} with no id: ${project.name}`);
                            continue;
                        }

                        try {
                            const repos = await gitApi.getRepositories(project.id);
                            allRepos.push(...repos);
                        } catch (error) {
                            logger.warn(`Failed to fetch repositories for project ${project.name}: ${error}`);
                        }
                    }

                    return allRepos;
                };

                return fetchWithRetry(fetchFn, `organization ${org}`, logger);
            });

            logger.debug(`Found ${data.length} repositories in organization ${org} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repositories for organization ${org}.`, error);

            // Check if it's a 404-like error (organization not found)
            if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
                logger.error(`Organization ${org} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: org
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundOrgs } = processPromiseResults<GitRepository>(results);

    return {
        validRepos,
        notFoundOrgs,
    };
}

async function getReposForProjects(
    projects: string[],
    baseUrl: string,
    token: string,
    useTfsPath: boolean
) {
    const results = await Promise.allSettled(projects.map(async (project) => {
        try {
            const [org, projectName] = project.split('/');
            logger.debug(`Fetching repositories for project ${project}...`);

            const { durationMs, data } = await measure(async () => {
                const fetchFn = async () => {
                    const orgUrl = buildOrgUrl(baseUrl, org, useTfsPath);
                    const connection = createAzureDevOpsConnection(orgUrl, token);
                    const gitApi = await connection.getGitApi();
                    
                    const repos = await gitApi.getRepositories(projectName);
                    return repos;
                };

                return fetchWithRetry(fetchFn, `project ${project}`, logger);
            });

            logger.debug(`Found ${data.length} repositories in project ${project} in ${durationMs}ms.`);
            return {
                type: 'valid' as const,
                data
            };
        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repositories for project ${project}.`, error);

            if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
                logger.error(`Project ${project} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: project
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundProjects } = processPromiseResults<GitRepository>(results);

    return {
        validRepos,
        notFoundProjects,
    };
}

async function getRepos(
    repoList: string[],
    baseUrl: string,
    token: string,
    useTfsPath: boolean
) {
    const results = await Promise.allSettled(repoList.map(async (repo) => {
        try {
            const [org, projectName, repoName] = repo.split('/');
            logger.info(`Fetching repository info for ${repo}...`);

            const { durationMs, data: result } = await measure(async () => {
                const fetchFn = async () => {
                    const orgUrl = buildOrgUrl(baseUrl, org, useTfsPath);
                    const connection = createAzureDevOpsConnection(orgUrl, token);
                    const gitApi = await connection.getGitApi();

                    const repo = await gitApi.getRepository(repoName, projectName);
                    return repo;
                };

                return fetchWithRetry(fetchFn, repo, logger);
            });

            logger.info(`Found info for repository ${repo} in ${durationMs}ms`);
            return {
                type: 'valid' as const,
                data: [result]
            };

        } catch (error) {
            Sentry.captureException(error);
            logger.error(`Failed to fetch repository ${repo}.`, error);

            if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
                logger.error(`Repository ${repo} not found or no access`);
                return {
                    type: 'notFound' as const,
                    value: repo
                };
            }
            throw error;
        }
    }));

    throwIfAnyFailed(results);
    const { validItems: validRepos, notFoundItems: notFoundRepos } = processPromiseResults<GitRepository>(results);

    return {
        validRepos,
        notFoundRepos,
    };
}