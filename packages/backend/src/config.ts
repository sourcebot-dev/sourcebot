import { PrismaClient } from '@sourcebot/db';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { DEFAULT_SETTINGS } from "./constants.js";
import { Database, updateSettings } from './db.js';
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig, GITLAB_CLOUD_HOSTNAME } from "./gitlab.js";
import { SourcebotConfigurationSchema } from "./schemas/v2.js";
import { AppContext, Repository, Settings } from "./types.js";
import { arraysEqualShallow, getTokenFromConfig, isRemotePath, marshalBool } from "./utils.js";

/**
 * Certain settings changes (e.g., the file limit size is changed) require
 * a reindexing of _all_ repositories.
 * 
 * @nocheckin : remove
 */
export const isAllRepoReindexingRequired = (previous: Settings, current: Settings) => {
    return (
        previous?.maxFileSize !== current?.maxFileSize
    )
}

/**
 * Certain configuration changes (e.g., a branch is added) require
 * a reindexing of the repository.
 * 
 * @nocheckin : remove
 */
export const isRepoReindexingRequired = (previous: Repository, current: Repository) => {
    /**
     * Checks if the any of the `revisions` properties have changed.
     */
    const isRevisionsChanged = () => {
        if (previous.vcs !== 'git' || current.vcs !== 'git') {
            return false;
        }

        return (
            !arraysEqualShallow(previous.branches, current.branches) ||
            !arraysEqualShallow(previous.tags, current.tags)
        );
    }

    /**
     * Check if the `exclude.paths` property has changed.
     */
    const isExcludePathsChanged = () => {
        if (previous.vcs !== 'local' || current.vcs !== 'local') {
            return false;
        }

        return !arraysEqualShallow(previous.excludedPaths, current.excludedPaths);
    }

    return (
        isRevisionsChanged() ||
        isExcludePathsChanged()
    )
}


export const syncConfig = async (configPath: string, oldDBTodoRefactor: Database, signal: AbortSignal, ctx: AppContext, db: PrismaClient) => {
    const configContent = await (async () => {
        if (isRemotePath(configPath)) {
            const response = await fetch(configPath, {
                signal,
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            return readFile(configPath, {
                encoding: 'utf-8',
                signal,
            });
        }
    })();

    // @todo: we should validate the configuration file's structure here.
    const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfigurationSchema;

    // Update the settings
    const updatedSettings: Settings = {
        maxFileSize: config.settings?.maxFileSize ?? DEFAULT_SETTINGS.maxFileSize,
        autoDeleteStaleRepos: config.settings?.autoDeleteStaleRepos ?? DEFAULT_SETTINGS.autoDeleteStaleRepos,
        reindexInterval: config.settings?.reindexInterval ?? DEFAULT_SETTINGS.reindexInterval,
        resyncInterval: config.settings?.resyncInterval ?? DEFAULT_SETTINGS.resyncInterval,
    }
    // const _isAllRepoReindexingRequired = isAllRepoReindexingRequired(db.data.settings, updatedSettings);
    await updateSettings(updatedSettings, oldDBTodoRefactor);

    for (const repoConfig of config.repos ?? []) {
        switch (repoConfig.type) {
            case 'github': {
                const token = repoConfig.token ? getTokenFromConfig(repoConfig.token, ctx) : undefined;
                const gitHubRepos = await getGitHubReposFromConfig(repoConfig, signal, ctx);
                const hostURL = repoConfig.url ?? 'https://github.com';
                const hostname = repoConfig.url ? new URL(repoConfig.url).hostname : 'github.com';

                await Promise.all(gitHubRepos.map((repo) => {
                    const repoName = `${hostname}/${repo.full_name}`;
                    const cloneUrl = new URL(repo.clone_url!);
                    if (token) {
                        cloneUrl.username = token;
                    }

                    const data = {
                        external_id: repo.id.toString(),
                        external_codeHostType: 'github',
                        external_codeHostURL: hostURL,
                        uri: cloneUrl.toString(),
                        isFork: repo.fork,
                        isArchived: !!repo.archived,
                        metadata: {
                            'zoekt.web-url-type': 'github',
                            'zoekt.web-url': repo.html_url,
                            'zoekt.name': repoName,
                            'zoekt.github-stars': (repo.stargazers_count ?? 0).toString(),
                            'zoekt.github-watchers': (repo.watchers_count ?? 0).toString(),
                            'zoekt.github-subscribers': (repo.subscribers_count ?? 0).toString(),
                            'zoekt.github-forks': (repo.forks_count ?? 0).toString(),
                            'zoekt.archived': marshalBool(repo.archived),
                            'zoekt.fork': marshalBool(repo.fork),
                            'zoekt.public': marshalBool(repo.private === false) 
                        },
                    };

                    return db.repo.upsert({
                        where: {
                            external_id_external_codeHostURL: {
                                external_id: repo.id.toString(),
                                external_codeHostURL: hostURL,
                            },
                        },
                        create: data,
                        update: data,
                    })
                }));

                break;
            }
            case 'gitlab': {
                const hostURL = repoConfig.url ?? 'https://gitlab.com';
                const hostname = repoConfig.url ? new URL(repoConfig.url).hostname : GITLAB_CLOUD_HOSTNAME;
                const token = repoConfig.token ? getTokenFromConfig(repoConfig.token, ctx) : undefined;
                const gitLabRepos = await getGitLabReposFromConfig(repoConfig, ctx);

                await Promise.all(gitLabRepos.map((project) => {
                        const repoId = `${hostname}/${project.path_with_namespace}`;
                        const isFork = project.forked_from_project !== undefined;

                        const cloneUrl = new URL(project.http_url_to_repo);
                        if (token) {
                            cloneUrl.username = 'oauth2';
                            cloneUrl.password = token;
                        }

                        const data = {
                            external_id: project.id.toString(),
                            external_codeHostType: 'gitlab',
                            external_codeHostURL: hostURL,
                            uri: cloneUrl.toString(),
                            isFork,
                            isArchived: project.archived,
                            metadata: {
                                'zoekt.web-url-type': 'gitlab',
                                'zoekt.web-url': project.web_url,
                                'zoekt.name': repoId,
                                'zoekt.gitlab-stars': project.star_count?.toString() ?? '0',
                                'zoekt.gitlab-forks': project.forks_count?.toString() ?? '0',
                                'zoekt.archived': marshalBool(project.archived),
                                'zoekt.fork': marshalBool(isFork),
                                'zoekt.public': marshalBool(project.visibility === 'public'),
                            }
                        }

                        return db.repo.upsert({
                            where: {
                                external_id_external_codeHostURL: {
                                    external_id: project.id.toString(),
                                    external_codeHostURL: hostURL,
                                },
                            },
                            create: data,
                            update: data,
                        })
                }));

                break;
            }
        }
    }
}