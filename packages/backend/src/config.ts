import { PrismaClient } from '@sourcebot/db';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig, GITLAB_CLOUD_HOSTNAME } from "./gitlab.js";
import { SourcebotConfigurationSchema } from "./schemas/v2.js";
import { AppContext } from "./types.js";
import { getTokenFromConfig, isRemotePath, marshalBool } from "./utils.js";

export const syncConfig = async (configPath: string, db: PrismaClient, signal: AbortSignal, ctx: AppContext) => {
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

    for (const repoConfig of config.repos ?? []) {
        switch (repoConfig.type) {
            case 'github': {
                const token = repoConfig.token ? getTokenFromConfig(repoConfig.token, ctx) : undefined;
                const gitHubRepos = await getGitHubReposFromConfig(repoConfig, signal, ctx);
                const hostUrl = repoConfig.url ?? 'https://github.com';
                const hostname = repoConfig.url ? new URL(repoConfig.url).hostname : 'github.com';
                const tenantId = repoConfig.tenantId ?? 0;

                await Promise.all(gitHubRepos.map((repo) => {
                    const repoName = `${hostname}/${repo.full_name}`;
                    const cloneUrl = new URL(repo.clone_url!);
                    if (token) {
                        cloneUrl.username = token;
                    }

                    const data = {
                        external_id: repo.id.toString(),
                        external_codeHostType: 'github',
                        external_codeHostUrl: hostUrl,
                        cloneUrl: cloneUrl.toString(),
                        name: repoName,
                        isFork: repo.fork,
                        isArchived: !!repo.archived,
                        tenantId: tenantId,
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
                            external_id_external_codeHostUrl: {
                                external_id: repo.id.toString(),
                                external_codeHostUrl: hostUrl,
                            },
                        },
                        create: data,
                        update: data,
                    })
                }));

                break;
            }
            case 'gitlab': {
                const hostUrl = repoConfig.url ?? 'https://gitlab.com';
                const hostname = repoConfig.url ? new URL(repoConfig.url).hostname : GITLAB_CLOUD_HOSTNAME;
                const token = repoConfig.token ? getTokenFromConfig(repoConfig.token, ctx) : undefined;
                const gitLabRepos = await getGitLabReposFromConfig(repoConfig, ctx);

                await Promise.all(gitLabRepos.map((project) => {
                        const repoName = `${hostname}/${project.path_with_namespace}`;
                        const isFork = project.forked_from_project !== undefined;

                        const cloneUrl = new URL(project.http_url_to_repo);
                        if (token) {
                            cloneUrl.username = 'oauth2';
                            cloneUrl.password = token;
                        }

                        const data = {
                            external_id: project.id.toString(),
                            external_codeHostType: 'gitlab',
                            external_codeHostUrl: hostUrl,
                            cloneUrl: cloneUrl.toString(),
                            name: repoName,
                            tenantId: 0, // TODO: add support for tenantId in GitLab config
                            isFork,
                            isArchived: project.archived,
                            metadata: {
                                'zoekt.web-url-type': 'gitlab',
                                'zoekt.web-url': project.web_url,
                                'zoekt.name': repoName,
                                'zoekt.gitlab-stars': project.star_count?.toString() ?? '0',
                                'zoekt.gitlab-forks': project.forks_count?.toString() ?? '0',
                                'zoekt.archived': marshalBool(project.archived),
                                'zoekt.fork': marshalBool(isFork),
                                'zoekt.public': marshalBool(project.visibility === 'public'),
                            }
                        }

                        return db.repo.upsert({
                            where: {
                                external_id_external_codeHostUrl: {
                                    external_id: project.id.toString(),
                                    external_codeHostUrl: hostUrl,
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