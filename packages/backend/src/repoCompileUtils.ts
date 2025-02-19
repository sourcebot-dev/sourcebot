import { GithubConnectionConfig } from '@sourcebot/schemas/v3/github.type';
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig } from "./gitlab.js";
import { getGiteaReposFromConfig } from "./gitea.js";
import { getGerritReposFromConfig } from "./gerrit.js";
import { Prisma, PrismaClient } from '@sourcebot/db';
import { WithRequired } from "./types.js"
import { marshalBool } from "./utils.js";
import { GerritConnectionConfig, GiteaConnectionConfig, GitlabConnectionConfig } from '@sourcebot/schemas/v3/connection.type';

export type RepoData = WithRequired<Prisma.RepoCreateInput, 'connections'>;

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
    const hostname = config.url ? new URL(config.url).hostname : 'github.com';

    const repos = gitHubRepos.map((repo) => {
        const repoName = `${hostname}/${repo.full_name}`;
        const cloneUrl = new URL(repo.clone_url!);

        const record: RepoData = {
            external_id: repo.id.toString(),
            external_codeHostType: 'github',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            name: repoName,
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
    
    const repos = gitlabRepos.map((project) => {
        const projectUrl = `${hostUrl}/${project.path_with_namespace}`;
        const cloneUrl = new URL(project.http_url_to_repo);
        const isFork = project.forked_from_project !== undefined;

        const record: RepoData = {
            external_id: project.id.toString(),
            external_codeHostType: 'gitlab',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            name: project.path_with_namespace,
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
                'zoekt.web-url-type': 'gitlab',
                'zoekt.web-url': projectUrl,
                'zoekt.name': project.path_with_namespace,
                'zoekt.gitlab-stars': (project.stargazers_count ?? 0).toString(),
                'zoekt.gitlab-forks': (project.forks_count ?? 0).toString(),
                'zoekt.archived': marshalBool(project.archived),
                'zoekt.fork': marshalBool(isFork),
                'zoekt.public': marshalBool(project.private === false)
            },
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

    const repos = giteaRepos.map((repo) => {
        const cloneUrl = new URL(repo.clone_url!);

        const record: RepoData = {
            external_id: repo.id!.toString(),
            external_codeHostType: 'gitea',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            name: repo.full_name!,
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
                'zoekt.web-url-type': 'gitea',
                'zoekt.web-url': repo.html_url!,
                'zoekt.name': repo.full_name!,
                'zoekt.archived': marshalBool(repo.archived),
                'zoekt.fork': marshalBool(repo.fork!),
                'zoekt.public': marshalBool(repo.internal === false && repo.private === false),
            },
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
    const hostUrl = config.url ?? 'https://gerritcodereview.com';
    const hostname = new URL(hostUrl).hostname;

    const repos = gerritRepos.map((project) => {
        const repoId = `${hostname}/${project.name}`;
        const cloneUrl = new URL(`${config.url}/${encodeURIComponent(project.name)}`);

        let webUrl = "https://www.gerritcodereview.com/";
        // Gerrit projects can have multiple web links; use the first one
        if (project.web_links) {
            const webLink = project.web_links[0];
            if (webLink) {
                webUrl = webLink.url;
            }
        }

        const record: RepoData = {
            external_id: project.id.toString(),
            external_codeHostType: 'gerrit',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            name: project.name,
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
                'zoekt.web-url-type': 'gitiles',
                'zoekt.web-url': webUrl,
                'zoekt.name': repoId,
                'zoekt.archived': marshalBool(false),
                'zoekt.fork': marshalBool(false),
                'zoekt.public': marshalBool(true),
            },
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