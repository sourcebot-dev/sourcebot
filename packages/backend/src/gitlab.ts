import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import micromatch from "micromatch";
import { createLogger } from "./logger.js";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type"
import { getTokenFromConfig, measure } from "./utils.js";
import { PrismaClient } from "@sourcebot/db";

const logger = createLogger("GitLab");
export const GITLAB_CLOUD_HOSTNAME = "gitlab.com";

export const getGitLabReposFromConfig = async (config: GitlabConnectionConfig, orgId: number, db: PrismaClient) => {
    // TODO: pass in DB here to fetch secret properly
    const token = config.token ? await getTokenFromConfig(config.token, orgId) : undefined;
    const api = new Gitlab({
        ...(config.token ? {
            token,
        } : {}),
        ...(config.url ? {
            host: config.url,
        } : {}),
    });
    const hostname = config.url ? new URL(config.url).hostname : GITLAB_CLOUD_HOSTNAME;


    let allProjects: ProjectSchema[] = [];

    if (config.all === true) {
        if (hostname !== GITLAB_CLOUD_HOSTNAME) {
            try {
                logger.debug(`Fetching all projects visible in ${config.url}...`);
                const { durationMs, data: _projects } = await measure(() => api.Projects.all({
                    perPage: 100,
                }));
                logger.debug(`Found ${_projects.length} projects in ${durationMs}ms.`);
                allProjects = allProjects.concat(_projects);
            } catch (e) {
                logger.error(`Failed to fetch all projects visible in ${config.url}.`, e);
            }
        } else {
            logger.warn(`Ignoring option all:true in ${ctx.configPath} : host is ${GITLAB_CLOUD_HOSTNAME}`);
        }
    }

    if (config.groups) {
        const _projects = (await Promise.all(config.groups.map(async (group) => {
            try {
                logger.debug(`Fetching project info for group ${group}...`);
                const { durationMs, data } = await measure(() => api.Groups.allProjects(group, {
                    perPage: 100,
                    includeSubgroups: true
                }));
                logger.debug(`Found ${data.length} projects in group ${group} in ${durationMs}ms.`);
                return data;
            } catch (e) {
                logger.error(`Failed to fetch project info for group ${group}.`, e);
                return [];
            }
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    if (config.users) {
        const _projects = (await Promise.all(config.users.map(async (user) => {
            try {
                logger.debug(`Fetching project info for user ${user}...`);
                const { durationMs, data } = await measure(() => api.Users.allProjects(user, {
                    perPage: 100,
                }));
                logger.debug(`Found ${data.length} projects owned by user ${user} in ${durationMs}ms.`);
                return data;
            } catch (e) {
                logger.error(`Failed to fetch project info for user ${user}.`, e);
                return [];
            }
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    if (config.projects) {
        const _projects = (await Promise.all(config.projects.map(async (project) => {
            try {
                logger.debug(`Fetching project info for project ${project}...`);
                const { durationMs, data } = await measure(() => api.Projects.show(project));
                logger.debug(`Found project ${project} in ${durationMs}ms.`);
                return [data];
            } catch (e) {
                logger.error(`Failed to fetch project info for project ${project}.`, e);
                return [];
            }
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    let repos = allProjects
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

    return repos;
}

export const shouldExcludeProject = ({
    project,
    include,
    exclude,
}: {
    project: ProjectSchema,
    include?: {
        topics?: GitLabConfig['topics'],
    },
    exclude?: GitLabConfig['exclude'],
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