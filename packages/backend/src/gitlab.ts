import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import micromatch from "micromatch";
import { createLogger } from "@sourcebot/logger";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type"
import { getTokenFromConfig, measure, fetchWithRetry } from "./utils.js";
import { PrismaClient } from "@sourcebot/db";
import { processPromiseResults, throwIfAnyFailed } from "./connectionUtils.js";
import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { log } from "console";

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
    });

    let allRepos: ProjectSchema[] = [];
    let notFound: {
        orgs: string[],
        users: string[],
        repos: string[],
    } = {
        orgs: [],
        users: [],
        repos: [],
    };

    if (config.all === true) {
        if (hostname !== GITLAB_CLOUD_HOSTNAME) {
            try {
                // Fetch all groups
                logger.debug(`Fetching all groups visible in ${config.url}...`);
                const { durationMs: groupsDuration, data: _groups } = await measure(async () => {
                    const fetchFn = () => api.Groups.all({ perPage: 100, allAvailable: true });
                    return fetchWithRetry(fetchFn, `all groups in ${config.url}`, logger);
                });
                logger.debug(`Found ${_groups.length} groups in ${groupsDuration}ms.`);

                config.groups = _groups.map(g => g.full_path);
                
                logger.debug(`Found these groups: ${config.groups.join('\n')}`);

                // Fetch all users - too much for sourcebot/gitlab
                logger.debug(`Fetching all users visible in ${config.url}...`);
                const { durationMs: usersDuration, data: _users } = await measure(async () => {
                    const fetchFn = () => api.Users.all({ perPage: 100, withoutProjects: false });
                    return fetchWithRetry(fetchFn, `all users in ${config.url}`, logger);
                });
                logger.debug(`Found ${_users.length} users in ${usersDuration}ms.`);

                config.users = _users.map(u => u.username);
            } catch (e) {
                Sentry.captureException(e);
                logger.error(`Failed to fetch all projects visible in ${config.url}.`, e);
                throw e;
            }
        } else {
            logger.warn(`Ignoring option all:true in config : host is ${GITLAB_CLOUD_HOSTNAME}`);
        }
    }

    if (config.groups) {
        const batchSize = 10;
        const allResults = [];
        
        // Process groups in batches of 10
        for (let i = 0; i < config.groups.length; i += batchSize) {
            const batch = config.groups.slice(i, i + batchSize);
            logger.debug(`Processing batch ${i/batchSize + 1} of ${Math.ceil(config.groups.length/batchSize)} (${batch.length} groups)`);
            
            const batchResults = await Promise.allSettled(batch.map(async (group) => {
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
                        logger.error(`Group ${group} not found or no access`);
                        return {
                            type: 'notFound' as const,
                            value: group
                        };
                    }
                    throw e;
                }
            }));
            allResults.push(...batchResults);
        }
        const { validItems: validRepos, notFoundItems: notFoundOrgs } = processPromiseResults(allResults);
        allRepos = allRepos.concat(validRepos);
        notFound.orgs = notFoundOrgs;
        logger.debug(`Found ${validRepos.length} valid repositories in groups.`);
        logger.debug(`Not found groups: ${notFoundOrgs.join(', ')}`);
        logger.debug(`These repositories will be downloaded: ${allRepos.map(repo => repo.path_with_namespace).join('\n')}`);
    }

    if (config.users) {
        const batchSize = 10;
        const allResults = [];
        
        // Process users in batches of 10
        for (let i = 0; i < config.users.length; i += batchSize) {
            const batch = config.users.slice(i, i + batchSize);
            logger.debug(`Processing batch ${i/batchSize + 1} of ${Math.ceil(config.users.length/batchSize)} (${batch.length} users)`);
            
            const batchResults = await Promise.allSettled(batch.map(async (user) => {
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
                        logger.error(`User ${user} not found or no access`);
                        return {
                            type: 'notFound' as const,
                            value: user
                        };
                    }
                    throw e;
                }
            }));
            
            allResults.push(...batchResults);
        }
        const { validItems: validRepos, notFoundItems: notFoundUsers } = processPromiseResults(allResults);
        allRepos = allRepos.concat(validRepos);
        notFound.users = notFoundUsers;
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
                    logger.error(`Project ${project} not found or no access`);
                    return {
                        type: 'notFound' as const,
                        value: project
                    };
                }
                throw e;
            }
        }));

        const { validItems: validRepos, notFoundItems: notFoundRepos } = processPromiseResults(results);
        allRepos = allRepos.concat(validRepos);
        notFound.repos = notFoundRepos;
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
        validRepos: repos,
        notFound,
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