import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import micromatch from "micromatch";
import { createLogger } from "@sourcebot/logger";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type"
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import { PrismaClient } from "@sourcebot/db";
import { processPromiseResults, throwIfAnyFailed } from "./connectionUtils.js";
import * as Sentry from "@sentry/node";
import { env } from "./env.js";

const logger = createLogger('gitlab');
export const GITLAB_CLOUD_HOSTNAME = "gitlab.com";

export const getGitLabReposFromConfig = async (config: GitlabConnectionConfig, orgId: number, db: PrismaClient) => {
    const hostname = config.url ?
        new URL(config.url).hostname :
        GITLAB_CLOUD_HOSTNAME;

    const token = config.token ?
        await getTokenFromConfig(config.token, orgId, db, logger) :
        hostname === GITLAB_CLOUD_HOSTNAME ?
        env.FALLBACK_GITLAB_CLOUD_TOKEN :
        undefined;
    
    const api = new Gitlab({
        ...(token ? {
            token,
        } : {}),
        ...(config.url ? {
            host: config.url,
        } : {}),
        queryTimeout: env.GITLAB_CLIENT_QUERY_TIMEOUT_SECONDS * 1000,
    });

    let allRepos: ProjectSchema[] = [];
    let allWarnings: string[] = [];

    if (config.all === true) {
        if (hostname !== GITLAB_CLOUD_HOSTNAME) {
            try {
                logger.debug(`Fetching all projects visible in ${config.url}...`);
                const { durationMs, data: _projects } = await measure(async () => {
                    const fetchFn = () => api.Projects.all({
                        perPage: 100,
                    });
                    return fetchWithRetry(fetchFn, `all projects in ${config.url}`, logger);
                });
                logger.debug(`Found ${_projects.length} projects in ${durationMs}ms.`);
                allRepos = allRepos.concat(_projects);
            } catch (e) {
                Sentry.captureException(e);
                logger.error(`Failed to fetch all projects visible in ${config.url}.`, e);
                throw e;
            }
        } else {
            const warning = `Ignoring option all:true in config : host is ${GITLAB_CLOUD_HOSTNAME}`;
            logger.warn(warning);
            allWarnings = allWarnings.concat(warning);
        }
    }

    if (config.groups) {
        const results = await Promise.allSettled(config.groups.map(async (group) => {
            try {
                logger.debug(`Fetching project info for group ${group}...`);
                const { durationMs, data } = await measure(async () => {
                    const fetchFn = () => api.Groups.allProjects(group, {
                        perPage: 100,
                        includeSubgroups: true
                    });
                    return fetchWithRetry(fetchFn, `group ${group}`, logger);
                });
                logger.debug(`Found ${data.length} projects in group ${group} in ${durationMs}ms.`);
                return {
                    type: 'valid' as const,
                    data
                };
            } catch (e: any) {
                Sentry.captureException(e);
                logger.error(`Failed to fetch projects for group ${group}.`, e);

                const status = e?.cause?.response?.status;
                if (status === 404) {
                    const warning = `Group ${group} not found or no access`;
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
        const { validItems: validRepos, warnings } = processPromiseResults(results);
        allRepos = allRepos.concat(validRepos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.users) {
        const results = await Promise.allSettled(config.users.map(async (user) => {
            try {
                logger.debug(`Fetching project info for user ${user}...`);
                const { durationMs, data } = await measure(async () => {
                    const fetchFn = () => api.Users.allProjects(user, {
                        perPage: 100,
                    });
                    return fetchWithRetry(fetchFn, `user ${user}`, logger);
                });
                logger.debug(`Found ${data.length} projects owned by user ${user} in ${durationMs}ms.`);
                return {
                    type: 'valid' as const,
                    data
                };
            } catch (e: any) {
                Sentry.captureException(e);
                logger.error(`Failed to fetch projects for user ${user}.`, e);

                const status = e?.cause?.response?.status;
                if (status === 404) {
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
        const { validItems: validRepos, warnings } = processPromiseResults(results);
        allRepos = allRepos.concat(validRepos);
        allWarnings = allWarnings.concat(warnings);
    }

    if (config.projects) {
        const results = await Promise.allSettled(config.projects.map(async (project) => {
            try {
                logger.debug(`Fetching project info for project ${project}...`);
                const { durationMs, data } = await measure(async () => {
                    const fetchFn = () => api.Projects.show(project);
                    return fetchWithRetry(fetchFn, `project ${project}`, logger);
                });
                logger.debug(`Found project ${project} in ${durationMs}ms.`);
                return {
                    type: 'valid' as const,
                    data: [data]
                };
            } catch (e: any) {
                Sentry.captureException(e);
                logger.error(`Failed to fetch project ${project}.`, e);

                const status = e?.cause?.response?.status;

                if (status === 404) {
                    const warning = `Project ${project} not found or no access`;
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
        const { validItems: validRepos, warnings } = processPromiseResults(results);
        allRepos = allRepos.concat(validRepos);
        allWarnings = allWarnings.concat(warnings);
    }

    let repos = allRepos
        .filter((project) => {
            const isExcluded = shouldExcludeProject({
                project,
                include: {
                    topics: config.topics,
                },
                exclude: config.exclude
            });

            return !isExcluded;
        });
        
    logger.debug(`Found ${repos.length} total repositories.`);

    return {
        repos,
        warnings: allWarnings,
    };
}

export const shouldExcludeProject = ({
    project,
    include,
    exclude,
}: {
    project: ProjectSchema,
    include?: {
        topics?: GitlabConnectionConfig['topics'],
    },
    exclude?: GitlabConnectionConfig['exclude'],
}) => {
    const projectName = project.path_with_namespace;
    let reason = '';

    const shouldExclude = (() => {
        if (!!exclude?.archived && project.archived) {
            reason = `\`exclude.archived\` is true`;
            return true;
        }

        if (!!exclude?.forks && project.forked_from_project !== undefined) {
            reason = `\`exclude.forks\` is true`;
            return true;
        }

        if (exclude?.userOwnedProjects && project.namespace.kind === 'user') {
            reason = `\`exclude.userOwnedProjects\` is true`;
            return true;
        }

        if (exclude?.projects) {
            if (micromatch.isMatch(projectName, exclude.projects)) {
                reason = `\`exclude.projects\` contains ${projectName}`;
                return true;
            }
        }

        if (include?.topics) {
            const configTopics = include.topics.map(topic => topic.toLowerCase());
            const projectTopics = project.topics ?? [];

            const matchingTopics = projectTopics.filter((topic) => micromatch.isMatch(topic, configTopics));
            if (matchingTopics.length === 0) {
                reason = `\`include.topics\` does not match any of the following topics: ${configTopics.join(', ')}`;
                return true;
            }
        }

        if (exclude?.topics) {
            const configTopics = exclude.topics.map(topic => topic.toLowerCase());
            const projectTopics = project.topics ?? [];

            const matchingTopics = projectTopics.filter((topic) => micromatch.isMatch(topic, configTopics));
            if (matchingTopics.length > 0) {
                reason = `\`exclude.topics\` matches the following topics: ${matchingTopics.join(', ')}`;
                return true;
            }
        }
    })();

    if (shouldExclude) {
        logger.debug(`Excluding project ${projectName}. Reason: ${reason}`);
        return true;
    }

    return false;
}