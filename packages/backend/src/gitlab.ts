import { Gitlab, ProjectSchema } from "@gitbeaker/rest";
import { GitLabConfig } from "./schemas/v2.js";
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, marshalBool, measure } from "./utils.js";
import { createLogger } from "./logger.js";
import { AppContext, Repository } from "./types.js";
import path from 'path';

const logger = createLogger("GitLab");

export const getGitLabReposFromConfig = async (config: GitLabConfig, ctx: AppContext) => {
    const api = new Gitlab({
        ...(config.token ? {
            token: config.token,
        } : {}),
        ...(config.url ? {
            host: config.url,
        } : {}),
    });

    let allProjects: ProjectSchema[] = [];

    if (config.groups) {
        const _projects = (await Promise.all(config.groups.map(async (group) => {
            logger.debug(`Fetching project info for group ${group}...`);
            const { durationMs, data } = await measure(() => api.Groups.allProjects(group, {
                perPage: 100,
                owned: true,
            }));
            logger.debug(`Found ${data.length} projects in group ${group} in ${durationMs}ms.`);

            return data;
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    if (config.users) {
        const _projects = (await Promise.all(config.users.map(async (user) => {
            logger.debug(`Fetching project info for user ${user}...`);
            const { durationMs, data } = await measure(() => api.Users.allProjects(user, {
                perPage: 100,
                owned: true,
            }));
            logger.debug(`Found ${data.length} projects owned by user ${user} in ${durationMs}ms.`);
            return data;
        }))).flat();

        allProjects = allProjects.concat(_projects);
    }

    if (config.projects) {
        const _projects = await Promise.all(config.projects.map(async (project) => {
            logger.debug(`Fetching project info for project ${project}...`);
            const { durationMs, data } = await measure(() => api.Projects.show(project));
            logger.debug(`Found project ${project} in ${durationMs}ms.`);
            return data;
        }));

        allProjects = allProjects.concat(_projects);
    }

    let repos: Repository[] = allProjects
        .map((project) => {
            const hostname = config.url ? new URL(config.url).hostname : "gitlab.com";
            const repoId = `${hostname}/${project.path_with_namespace}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`))
            const isFork = project.forked_from_project !== undefined;

            const cloneUrl = new URL(project.http_url_to_repo);
            if (config.token) {
                cloneUrl.username = 'oauth2';
                cloneUrl.password = config.token;
            }

            return {
                name: project.path_with_namespace,
                id: repoId,
                cloneUrl: cloneUrl.toString(),
                path: repoPath,
                isStale: false,
                isFork,
                isArchived: project.archived,
                gitConfigMetadata: {
                    'zoekt.web-url-type': 'gitlab',
                    'zoekt.web-url': project.web_url,
                    'zoekt.name': repoId,
                    'zoekt.gitlab-stars': project.star_count.toString(),
                    'zoekt.gitlab-forks': project.forks_count.toString(),
                    'zoekt.archived': marshalBool(project.archived),
                    'zoekt.fork': marshalBool(isFork),
                    'zoekt.public': marshalBool(project.visibility === 'public'),
                }
            } satisfies Repository;
        });

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
    }

    logger.debug(`Found ${repos.length} total repositories.`);

    return repos;
}
