import { GithubConnectionConfig } from '@sourcebot/schemas/v3/github.type';
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig } from "./gitlab.js";
import { getGiteaReposFromConfig } from "./gitea.js";
import { getGerritReposFromConfig } from "./gerrit.js";
import { getBitbucketReposFromConfig } from "./bitbucket.js";
import { SchemaRepository as BitbucketServerRepository } from "@coderabbitai/bitbucket/server/openapi";
import { SchemaRepository as BitbucketCloudRepository } from "@coderabbitai/bitbucket/cloud/openapi";
import { Prisma, PrismaClient } from '@sourcebot/db';
import { WithRequired } from "./types.js"
import { marshalBool } from "./utils.js";
import { createLogger } from './logger.js';
import { BitbucketConnectionConfig, GerritConnectionConfig, GiteaConnectionConfig, GitlabConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { RepoMetadata } from './types.js';
import path from 'path';

export type RepoData = WithRequired<Prisma.RepoCreateInput, 'connections'>;

const logger = createLogger('RepoCompileUtils');

export const compileGithubConfig = async (
    config: GithubConnectionConfig,
    connectionId: number,
    orgId: number,
    db: PrismaClient,
    abortController: AbortController): Promise<{
        repoData: RepoData[],
        notFound: {
            users: string[],
            orgs: string[],
            repos: string[],
        }
    }> => {
    const gitHubReposResult = await getGitHubReposFromConfig(config, orgId, db, abortController.signal);
    const gitHubRepos = gitHubReposResult.validRepos;
    const notFound = gitHubReposResult.notFound;

    const hostUrl = config.url ?? 'https://github.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = gitHubRepos.map((repo) => {
        const repoDisplayName = repo.full_name;
        const repoName = path.join(repoNameRoot, repoDisplayName);
        const cloneUrl = new URL(repo.clone_url!);

        logger.debug(`Found github repo ${repoDisplayName} with webUrl: ${repo.html_url}`);

        const record: RepoData = {
            external_id: repo.id.toString(),
            external_codeHostType: 'github',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            webUrl: repo.html_url,
            name: repoName,
            displayName: repoDisplayName,
            imageUrl: repo.owner.avatar_url,
            isFork: repo.fork,
            isArchived: !!repo.archived,
            org: {
                connect: {
                    id: orgId,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    'zoekt.web-url-type': 'github',
                    'zoekt.web-url': repo.html_url,
                    'zoekt.name': repoName,
                    'zoekt.github-stars': (repo.stargazers_count ?? 0).toString(),
                    'zoekt.github-watchers': (repo.watchers_count ?? 0).toString(),
                    'zoekt.github-subscribers': (repo.subscribers_count ?? 0).toString(),
                    'zoekt.github-forks': (repo.forks_count ?? 0).toString(),
                    'zoekt.archived': marshalBool(repo.archived),
                    'zoekt.fork': marshalBool(repo.fork),
                    'zoekt.public': marshalBool(repo.private === false),
                    'zoekt.display-name': repoDisplayName,
                },
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        notFound,
    };
}

export const compileGitlabConfig = async (
    config: GitlabConnectionConfig,
    connectionId: number,
    orgId: number,
    db: PrismaClient) => {

    const gitlabReposResult = await getGitLabReposFromConfig(config, orgId, db);
    const gitlabRepos = gitlabReposResult.validRepos;
    const notFound = gitlabReposResult.notFound;

    const hostUrl = config.url ?? 'https://gitlab.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = gitlabRepos.map((project) => {
        const projectUrl = `${hostUrl}/${project.path_with_namespace}`;
        const cloneUrl = new URL(project.http_url_to_repo);
        const isFork = project.forked_from_project !== undefined;
        const repoDisplayName = project.path_with_namespace;
        const repoName = path.join(repoNameRoot, repoDisplayName);

        logger.debug(`Found gitlab repo ${repoDisplayName} with webUrl: ${projectUrl}`);

        const record: RepoData = {
            external_id: project.id.toString(),
            external_codeHostType: 'gitlab',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            webUrl: projectUrl,
            name: repoName,
            displayName: repoDisplayName,
            imageUrl: project.avatar_url,
            isFork: isFork,
            isArchived: !!project.archived,
            org: {
                connect: {
                    id: orgId,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    'zoekt.web-url-type': 'gitlab',
                    'zoekt.web-url': projectUrl,
                    'zoekt.name': repoName,
                    'zoekt.gitlab-stars': (project.stargazers_count ?? 0).toString(),
                    'zoekt.gitlab-forks': (project.forks_count ?? 0).toString(),
                    'zoekt.archived': marshalBool(project.archived),
                    'zoekt.fork': marshalBool(isFork),
                    'zoekt.public': marshalBool(project.private === false),
                    'zoekt.display-name': repoDisplayName,
                },
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        notFound,
    };
}

export const compileGiteaConfig = async (
    config: GiteaConnectionConfig,
    connectionId: number,
    orgId: number,
    db: PrismaClient) => {

    const giteaReposResult = await getGiteaReposFromConfig(config, orgId, db);
    const giteaRepos = giteaReposResult.validRepos;
    const notFound = giteaReposResult.notFound;

    const hostUrl = config.url ?? 'https://gitea.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = giteaRepos.map((repo) => {
        const cloneUrl = new URL(repo.clone_url!);
        const repoDisplayName = repo.full_name!;
        const repoName = path.join(repoNameRoot, repoDisplayName);

        logger.debug(`Found gitea repo ${repoDisplayName} with webUrl: ${repo.html_url}`);

        const record: RepoData = {
            external_id: repo.id!.toString(),
            external_codeHostType: 'gitea',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            webUrl: repo.html_url,
            name: repoName,
            displayName: repoDisplayName,
            imageUrl: repo.owner?.avatar_url,
            isFork: repo.fork!,
            isArchived: !!repo.archived,
            org: {
                connect: {
                    id: orgId,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    'zoekt.web-url-type': 'gitea',
                    'zoekt.web-url': repo.html_url!,
                    'zoekt.name': repoName,
                    'zoekt.archived': marshalBool(repo.archived),
                    'zoekt.fork': marshalBool(repo.fork!),
                    'zoekt.public': marshalBool(repo.internal === false && repo.private === false),
                    'zoekt.display-name': repoDisplayName,
                },
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        notFound,
    };
}

export const compileGerritConfig = async (
    config: GerritConnectionConfig,
    connectionId: number,
    orgId: number) => {

    const gerritRepos = await getGerritReposFromConfig(config);
    const hostUrl = config.url;
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = gerritRepos.map((project) => {
        const cloneUrl = new URL(path.join(hostUrl, encodeURIComponent(project.name)));
        const repoDisplayName = project.name;
        const repoName = path.join(repoNameRoot, repoDisplayName);

        const webUrl = (() => {
            if (!project.web_links || project.web_links.length === 0) {
                return null;
            }

            const webLink = project.web_links[0];
            const webUrl = webLink.url;

            logger.debug(`Found gerrit repo ${project.name} with webUrl: ${webUrl}`);

            // Handle case where webUrl is just a gitiles path
            // https://github.com/GerritCodeReview/plugins_gitiles/blob/5ee7f57/src/main/java/com/googlesource/gerrit/plugins/gitiles/GitilesWeblinks.java#L50
            if (webUrl.startsWith('/plugins/gitiles/')) {
                logger.debug(`WebUrl is a gitiles path, joining with hostUrl: ${webUrl}`);
                return new URL(path.join(hostUrl, webUrl)).toString();
            } else {
                logger.debug(`WebUrl is not a gitiles path, returning as is: ${webUrl}`);
                return webUrl;
            }
        })();

        const record: RepoData = {
            external_id: project.id.toString(),
            external_codeHostType: 'gerrit',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            webUrl: webUrl,
            name: repoName,
            displayName: repoDisplayName,
            isFork: false,
            isArchived: false,
            org: {
                connect: {
                    id: orgId,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    'zoekt.web-url-type': 'gitiles',
                    'zoekt.web-url': webUrl ?? '',
                    'zoekt.name': repoName,
                    'zoekt.archived': marshalBool(false),
                    'zoekt.fork': marshalBool(false),
                    'zoekt.public': marshalBool(true),
                    'zoekt.display-name': repoDisplayName,
                },
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        notFound: {
            users: [],
            orgs: [],
            repos: [],
        }
    };
}

export const compileBitbucketConfig = async (
    config: BitbucketConnectionConfig,
    connectionId: number,
    orgId: number,
    db: PrismaClient) => {

    const bitbucketReposResult = await getBitbucketReposFromConfig(config, orgId, db);
    const bitbucketRepos = bitbucketReposResult.validRepos;
    const notFound = bitbucketReposResult.notFound;

    const hostUrl = config.url ?? 'https://bitbucket.org';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = bitbucketRepos.map((repo) => {
        const deploymentType = config.deploymentType;
        let record: RepoData;
        if (deploymentType === 'server') {
            const serverRepo = repo as BitbucketServerRepository;

            const repoDisplayName = serverRepo.name!;
            const repoName = path.join(repoNameRoot, repoDisplayName);
            const cloneUrl = `${hostUrl}/${serverRepo.slug}`;
            const webUrl = `${hostUrl}/${serverRepo.slug}`;

            record = {
                external_id: serverRepo.id!.toString(),
                external_codeHostType: 'bitbucket-server',
                external_codeHostUrl: hostUrl,
                cloneUrl: cloneUrl.toString(),
                webUrl: webUrl.toString(),
                name: repoName,
                displayName: repoDisplayName,
                isFork: false,
                isArchived: false,
                org: {
                    connect: {
                        id: orgId,
                    },
                },
                connections: {
                    create: {
                        connectionId: connectionId,
                    }
                },
                metadata: {
                    gitConfig: {
                        'zoekt.web-url-type': 'bitbucket-server',
                        'zoekt.web-url': webUrl ?? '',
                        'zoekt.name': repoName,
                        'zoekt.archived': marshalBool(false),
                        'zoekt.fork': marshalBool(false),
                        'zoekt.public': marshalBool(serverRepo.public),
                        'zoekt.display-name': repoDisplayName,
                    },
                },
            }
        } else {
            const cloudRepo = repo as BitbucketCloudRepository;

            const repoDisplayName = cloudRepo.full_name!;
            const repoName = path.join(repoNameRoot, repoDisplayName);

            const cloneInfo = cloudRepo.links!.clone![0];
            const webInfo = cloudRepo.links!.self!;
            const cloneUrl = new URL(cloneInfo.href!);
            const webUrl = new URL(webInfo.href!);

            record = {
                external_id: cloudRepo.uuid!,
                external_codeHostType: 'bitbucket-cloud',
                external_codeHostUrl: hostUrl,
                cloneUrl: cloneUrl.toString(),
                webUrl: webUrl.toString(),
                name: repoName,
                displayName: repoDisplayName,
                isFork: false,
                isArchived: false,
                org: {
                    connect: {
                        id: orgId,
                    },
                },
                connections: {
                    create: {
                        connectionId: connectionId,
                    }
                },
                metadata: {
                    gitConfig: {
                        'zoekt.web-url-type': 'bitbucket-cloud',
                        'zoekt.web-url': webUrl.toString(),
                        'zoekt.name': repoName,
                        'zoekt.archived': marshalBool(false),
                        'zoekt.fork': marshalBool(false),
                        'zoekt.public': marshalBool(cloudRepo.is_private === false),
                        'zoekt.display-name': repoDisplayName,
                    },
                },
            }
        }

        return record;
    })

    return {
        repoData: repos,
        notFound,
    };
}