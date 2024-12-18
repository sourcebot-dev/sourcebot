import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import { GitLabConfig } from "./schemas/v2.js";
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, excludeReposByTopic, getTokenFromConfig, includeReposByTopic, marshalBool, measure } from "./utils.js";
import { createLogger } from "./logger.js";
import { AppContext, GitRepository } from "./types.js";
import path from 'path';
import micromatch from "micromatch";

const logger = createLogger("GitLab");
const GITLAB_CLOUD_HOSTNAME = "gitlab.com";

export const getGitLabReposFromConfig = async (config: GitLabConfig, ctx: AppContext) => {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;
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
            } catch (e: any) {
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
            } catch (e: any) {
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
            } catch (e: any) {
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
            } catch (e: any) {
                logger.error(`Failed to fetch project info for project ${project}.`, e);
                return [];
            }
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    let repos: GitRepository[] = allProjects
        .map((project) => {
            const repoId = `${hostname}/${project.path_with_namespace}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`))
            const isFork = project.forked_from_project !== undefined;

            const cloneUrl = new URL(project.http_url_to_repo);
            if (token) {
                cloneUrl.username = 'oauth2';
                cloneUrl.password = token;
            }

            return {
                vcs: 'git',
                codeHost: 'gitlab',
                name: project.path_with_namespace,
                id: repoId,
                cloneUrl: cloneUrl.toString(),
                path: repoPath,
                isStale: false,
                isFork,
                isArchived: project.archived,
                topics: project.topics ?? [],
                gitConfigMetadata: {
                    'zoekt.web-url-type': 'gitlab',
                    'zoekt.web-url': project.web_url,
                    'zoekt.name': repoId,
                    'zoekt.gitlab-stars': project.star_count?.toString() ?? '0',
                    'zoekt.gitlab-forks': project.forks_count?.toString() ?? '0',
                    'zoekt.archived': marshalBool(project.archived),
                    'zoekt.fork': marshalBool(isFork),
                    'zoekt.public': marshalBool(project.visibility === 'public'),
                },
                branches: [],
                tags: [],
            } satisfies GitRepository;
        });

    if (config.topics) {
        const topics = config.topics.map(topic => topic.toLowerCase());
        repos = includeReposByTopic(repos, topics, logger);
    }

    if (config.exclude) {
        if (!!config.exclude.forks) {
            repos = excludeForkedRepos(repos, logger);
        }

        if (!!config.exclude.archived) {
            repos = excludeArchivedRepos(repos, logger);
        }

        if (config.exclude.projects) {
            repos = excludeReposByName(repos, config.exclude.projects, logger);
        }

        if (config.exclude.topics) {
            const topics = config.exclude.topics.map(topic => topic.toLowerCase());
            repos = excludeReposByTopic(repos, topics, logger);
        }
    }

    logger.debug(`Found ${repos.length} total repositories.`);

    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            repos = await Promise.all(repos.map(async (repo) => {
                logger.debug(`Fetching branches for repo ${repo.name}...`);
                let { durationMs, data } = await measure(() => api.Branches.all(repo.name));
                logger.debug(`Found ${data.length} branches in repo ${repo.name} in ${durationMs}ms.`);

                let branches = data.map((branch) => branch.name);
                branches = micromatch.match(branches, branchGlobs);

                return {
                    ...repo,
                    branches,
                };
            }));
        }

        if (config.revisions.tags) {
            const tagGlobs = config.revisions.tags;
            repos = await Promise.all(repos.map(async (repo) => {
                logger.debug(`Fetching tags for repo ${repo.name}...`);
                let { durationMs, data } = await measure(() => api.Tags.all(repo.name));
                logger.debug(`Found ${data.length} tags in repo ${repo.name} in ${durationMs}ms.`);

                let tags = data.map((tag) => tag.name);
                tags = micromatch.match(tags, tagGlobs);

                return {
                    ...repo,
                    tags,
                };
            }));
        }
    }

    return repos;
}
