import { GithubConnectionConfig } from '@sourcebot/schemas/v3/github.type';
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig } from "./gitlab.js";
import { getGiteaReposFromConfig } from "./gitea.js";
import { getGerritReposFromConfig } from "./gerrit.js";
import { BitbucketRepository, getBitbucketReposFromConfig } from "./bitbucket.js";
import { getAzureDevOpsReposFromConfig } from "./azuredevops.js";
import { SchemaRestRepository as BitbucketServerRepository } from "@coderabbitai/bitbucket/server/openapi";
import { SchemaRepository as BitbucketCloudRepository } from "@coderabbitai/bitbucket/cloud/openapi";
import { CodeHostType, Prisma } from '@sourcebot/db';
import { WithRequired } from "./types.js"
import { marshalBool } from "./utils.js";
import { createLogger } from '@sourcebot/logger';
import { BitbucketConnectionConfig, GerritConnectionConfig, GiteaConnectionConfig, GitlabConnectionConfig, GenericGitHostConnectionConfig, AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { ProjectVisibility } from "azure-devops-node-api/interfaces/CoreInterfaces.js";
import path from 'path';
import { glob } from 'glob';
import { getOriginUrl, isPathAValidGitRepoRoot, isUrlAValidGitRepo } from './git.js';
import assert from 'assert';
import GitUrlParse from 'git-url-parse';
import { RepoMetadata } from '@sourcebot/shared';
import { SINGLE_TENANT_ORG_ID } from './constants.js';
<<<<<<< HEAD
=======
import pLimit from 'p-limit';
>>>>>>> main

export type RepoData = WithRequired<Prisma.RepoCreateInput, 'connections'>;

const logger = createLogger('repo-compile-utils');

// Limit concurrent git operations to prevent resource exhaustion (EAGAIN errors)
// when processing thousands of repositories simultaneously
const MAX_CONCURRENT_GIT_OPERATIONS = 100;
const gitOperationLimit = pLimit(MAX_CONCURRENT_GIT_OPERATIONS);

type CompileResult = {
    repoData: RepoData[],
    warnings: string[],
}

export const compileGithubConfig = async (
    config: GithubConnectionConfig,
    connectionId: number,
    abortController: AbortController): Promise<CompileResult> => {
    const gitHubReposResult = await getGitHubReposFromConfig(config, abortController.signal);
    const gitHubRepos = gitHubReposResult.repos;
    const warnings = gitHubReposResult.warnings;

    const hostUrl = config.url ?? 'https://github.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = gitHubRepos.map((repo) => {
        const repoDisplayName = repo.full_name;
        const repoName = path.join(repoNameRoot, repoDisplayName);
        const cloneUrl = new URL(repo.clone_url!);
        const isPublic = repo.private === false;

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
            isPublic: isPublic,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
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
                    'zoekt.public': marshalBool(isPublic),
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
        warnings,
    };
}

export const compileGitlabConfig = async (
    config: GitlabConnectionConfig,
    connectionId: number): Promise<CompileResult> => {

    const gitlabReposResult = await getGitLabReposFromConfig(config);
    const gitlabRepos = gitlabReposResult.repos;
    const warnings = gitlabReposResult.warnings;

    const hostUrl = config.url ?? 'https://gitlab.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = gitlabRepos.map((project) => {
        const projectUrl = `${hostUrl}/${project.path_with_namespace}`;
        const cloneUrl = new URL(project.http_url_to_repo);
        const isFork = project.forked_from_project !== undefined;
        const isPublic = project.visibility === 'public';
        const repoDisplayName = project.path_with_namespace;
        const repoName = path.join(repoNameRoot, repoDisplayName);
        // project.avatar_url is not directly accessible with tokens; use the avatar API endpoint if available
        const avatarUrl = project.avatar_url
            ? new URL(`/api/v4/projects/${project.id}/avatar`, hostUrl).toString()
            : null;
        logger.debug(`Found gitlab repo ${repoDisplayName} with webUrl: ${projectUrl}`);

        const record: RepoData = {
            external_id: project.id.toString(),
            external_codeHostType: 'gitlab',
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl.toString(),
            webUrl: projectUrl,
            name: repoName,
            displayName: repoDisplayName,
            imageUrl: avatarUrl,
            isFork: isFork,
            isPublic: isPublic,
            isArchived: !!project.archived,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
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
                    'zoekt.public': marshalBool(isPublic),
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
        warnings,
    };
}

export const compileGiteaConfig = async (
    config: GiteaConnectionConfig,
    connectionId: number): Promise<CompileResult> => {

    const giteaReposResult = await getGiteaReposFromConfig(config);
    const giteaRepos = giteaReposResult.repos;
    const warnings = giteaReposResult.warnings;

    const hostUrl = config.url ?? 'https://gitea.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = giteaRepos.map((repo) => {
        const configUrl = new URL(hostUrl);
        const cloneUrl = new URL(repo.clone_url!);
        cloneUrl.host = configUrl.host
        const repoDisplayName = repo.full_name!;
        const repoName = path.join(repoNameRoot, repoDisplayName);
        const isPublic = repo.internal === false && repo.private === false;

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
            isPublic: isPublic,
            isArchived: !!repo.archived,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
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
                    'zoekt.public': marshalBool(isPublic),
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
        warnings,
    };
}

export const compileGerritConfig = async (
    config: GerritConnectionConfig,
    connectionId: number): Promise<CompileResult> => {

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
                    id: SINGLE_TENANT_ORG_ID,
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
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        warnings: [],
    };
}

export const compileBitbucketConfig = async (
    config: BitbucketConnectionConfig,
    connectionId: number): Promise<CompileResult> => {

    const bitbucketReposResult = await getBitbucketReposFromConfig(config);
    const bitbucketRepos = bitbucketReposResult.repos;
    const warnings = bitbucketReposResult.warnings;

    const hostUrl = config.url ?? 'https://bitbucket.org';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const getCloneUrl = (repo: BitbucketRepository) => {
        if (!repo.links) {
            throw new Error(`No clone links found for server repo ${repo.name}`);
        }

        // In the cloud case we simply fetch the html link and use that as the clone url. For server we
        // need to fetch the actual clone url
        if (config.deploymentType === 'cloud') {
            const htmlLink = repo.links.html as { href: string };
            return htmlLink.href;
        }

        const cloneLinks = repo.links.clone as {
            href: string;
            name: string;
        }[];

        for (const link of cloneLinks) {
            if (link.name === 'http') {
                return link.href;
            }
        }

        throw new Error(`No clone links found for repo ${repo.name}`);
    }

    const getWebUrl = (repo: BitbucketRepository) => {
        const isServer = config.deploymentType === 'server';
        const repoLinks = (repo as BitbucketServerRepository | BitbucketCloudRepository).links;
        const repoName = isServer ? (repo as BitbucketServerRepository).name : (repo as BitbucketCloudRepository).full_name;

        if (!repoLinks) {
            throw new Error(`No links found for ${isServer ? 'server' : 'cloud'} repo ${repoName}`);
        }

        // In server case we get an array of length == 1 links in the self field, while in cloud case we get a single
        // link object in the html field
        const link = isServer ? (repoLinks.self as { name: string, href: string }[])?.[0] : repoLinks.html as { href: string };
        if (!link || !link.href) {
            throw new Error(`No ${isServer ? 'self' : 'html'} link found for ${isServer ? 'server' : 'cloud'} repo ${repoName}`);
        }

        return link.href;
    }

    const repos = bitbucketRepos.map((repo) => {
        const isServer = config.deploymentType === 'server';
        const codeHostType: CodeHostType = isServer ? 'bitbucketServer' : 'bitbucketCloud';
        const displayName = isServer ? (repo as BitbucketServerRepository).name! : (repo as BitbucketCloudRepository).full_name!;
        const externalId = isServer ? (repo as BitbucketServerRepository).id!.toString() : (repo as BitbucketCloudRepository).uuid!;
        const isPublic = isServer ? (repo as BitbucketServerRepository).public : (repo as BitbucketCloudRepository).is_private === false;
        const isArchived = isServer ? (repo as BitbucketServerRepository).archived === true : false;
        const isFork = isServer ? (repo as BitbucketServerRepository).origin !== undefined : (repo as BitbucketCloudRepository).parent !== undefined;
        const repoName = path.join(repoNameRoot, displayName);
        const cloneUrl = getCloneUrl(repo);
        const webUrl = getWebUrl(repo);

        const record: RepoData = {
            external_id: externalId,
            external_codeHostType: codeHostType,
            external_codeHostUrl: hostUrl,
            cloneUrl: cloneUrl,
            webUrl: webUrl,
            name: repoName,
            displayName: displayName,
            isFork: isFork,
            isPublic: isPublic,
            isArchived: isArchived,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    // zoekt expects bitbucket-server and bitbucket-cloud
                    'zoekt.web-url-type': codeHostType === 'bitbucketServer' ? 'bitbucket-server' : 'bitbucket-cloud',
                    'zoekt.web-url': webUrl,
                    'zoekt.name': repoName,
                    'zoekt.archived': marshalBool(isArchived),
                    'zoekt.fork': marshalBool(isFork),
                    'zoekt.public': marshalBool(isPublic),
                    'zoekt.display-name': displayName,
                },
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
            } satisfies RepoMetadata,
        };

        return record;
    })

    return {
        repoData: repos,
        warnings,
    };
}

export const compileGenericGitHostConfig = async (
    config: GenericGitHostConnectionConfig,
    connectionId: number
): Promise<CompileResult> => {
    const configUrl = new URL(config.url);
    if (configUrl.protocol === 'file:') {
        return compileGenericGitHostConfig_file(config, connectionId);
    }
    else if (configUrl.protocol === 'http:' || configUrl.protocol === 'https:') {
        return compileGenericGitHostConfig_url(config, connectionId);
    }
    else {
        // Schema should prevent this, but throw an error just in case.
        throw new Error(`Unsupported protocol: ${configUrl.protocol}`);
    }
}

export const compileGenericGitHostConfig_file = async (
    config: GenericGitHostConnectionConfig,
    connectionId: number,
): Promise<CompileResult> => {
    const configUrl = new URL(config.url);
    assert(configUrl.protocol === 'file:', 'config.url must be a file:// URL');

    // Resolve the glob pattern to a list of repo-paths
    const repoPaths = await glob(configUrl.pathname, {
        absolute: true,
    });

    const repos: RepoData[] = [];
    const warnings: string[] = [];

<<<<<<< HEAD
    await Promise.all(repoPaths.map(async (repoPath) => {
=======
    await Promise.all(repoPaths.map((repoPath) => gitOperationLimit(async () => {
>>>>>>> main
        const isGitRepo = await isPathAValidGitRepoRoot({
            path: repoPath,
        });
        if (!isGitRepo) {
            const warning = `Skipping ${repoPath} - not a git repository.`;
            logger.warn(warning);
            warnings.push(warning);
            return;
        }

        const origin = await getOriginUrl(repoPath);
        if (!origin) {
            const warning = `Skipping ${repoPath} - remote.origin.url not found in git config.`;
            logger.warn(warning);
            warnings.push(warning);
            return;
        }

        const remoteUrl = GitUrlParse(origin);

        // @note: matches the naming here:
        // https://github.com/sourcebot-dev/zoekt/blob/main/gitindex/index.go#L293
        const repoName = path.join(remoteUrl.host, remoteUrl.pathname.replace(/\.git$/, ''));

        const repo: RepoData = {
            external_codeHostType: 'genericGitHost',
            external_codeHostUrl: remoteUrl.resource,
            external_id: remoteUrl.toString(),
            cloneUrl: `file://${repoPath}`,
            name: repoName,
            displayName: repoName,
            isFork: false,
            isArchived: false,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                branches: config.revisions?.branches ?? undefined,
                tags: config.revisions?.tags ?? undefined,
                // @NOTE: We don't set a gitConfig here since local repositories
                // are readonly.
                gitConfig: undefined,
            } satisfies RepoMetadata,
        }

        repos.push(repo);
    })));

    return {
        repoData: repos,
        warnings,
    }
}


export const compileGenericGitHostConfig_url = async (
    config: GenericGitHostConnectionConfig,
    connectionId: number,
): Promise<CompileResult> => {
    const remoteUrl = new URL(config.url);
    assert(remoteUrl.protocol === 'http:' || remoteUrl.protocol === 'https:', 'config.url must be a http:// or https:// URL');

    const warnings: string[] = [];

    // Validate that we are dealing with a valid git repo.
    const isGitRepo = await isUrlAValidGitRepo(remoteUrl.toString());
    if (!isGitRepo) {
        const warning = `Skipping ${remoteUrl.toString()} - not a git repository.`;
        logger.warn(warning);
        warnings.push(warning);
        return {
            repoData: [],
            warnings,
        }
    }

    // @note: matches the naming here:
    // https://github.com/sourcebot-dev/zoekt/blob/main/gitindex/index.go#L293
    const repoName = path.join(remoteUrl.host, remoteUrl.pathname.replace(/\.git$/, ''));

    const repo: RepoData = {
        external_codeHostType: 'genericGitHost',
        external_codeHostUrl: remoteUrl.origin,
        external_id: remoteUrl.toString(),
        cloneUrl: remoteUrl.toString(),
        name: repoName,
        displayName: repoName,
        isFork: false,
        isArchived: false,
        org: {
            connect: {
                id: SINGLE_TENANT_ORG_ID,
            },
        },
        connections: {
            create: {
                connectionId: connectionId,
            }
        },
        metadata: {
            branches: config.revisions?.branches ?? undefined,
            tags: config.revisions?.tags ?? undefined,
        }
    };

    return {
        repoData: [repo],
        warnings,
    }
}

export const compileAzureDevOpsConfig = async (
    config: AzureDevOpsConnectionConfig,
    connectionId: number): Promise<CompileResult> => {

    const azureDevOpsReposResult = await getAzureDevOpsReposFromConfig(config);
    const azureDevOpsRepos = azureDevOpsReposResult.repos;
    const warnings = azureDevOpsReposResult.warnings;

    const hostUrl = config.url ?? 'https://dev.azure.com';
    const repoNameRoot = new URL(hostUrl)
        .toString()
        .replace(/^https?:\/\//, '');

    const repos = azureDevOpsRepos.map((repo) => {
        if (!repo.project) {
            throw new Error(`No project found for repository ${repo.name}`);
        }

        const repoDisplayName = `${repo.project.name}/${repo.name}`;
        const repoName = path.join(repoNameRoot, repoDisplayName);
        const isPublic = repo.project.visibility === ProjectVisibility.Public;

        if (!repo.remoteUrl) {
            throw new Error(`No remoteUrl found for repository ${repoDisplayName}`);
        }
        if (!repo.id) {
            throw new Error(`No id found for repository ${repoDisplayName}`);
        }

        // Construct web URL for the repository
        const webUrl = repo.webUrl || `${hostUrl}/${repo.project.name}/_git/${repo.name}`;

        logger.debug(`Found Azure DevOps repo ${repoDisplayName} with webUrl: ${webUrl}`);

        const record: RepoData = {
            external_id: repo.id.toString(),
            external_codeHostType: 'azuredevops',
            external_codeHostUrl: hostUrl,
            cloneUrl: webUrl,
            webUrl: webUrl,
            name: repoName,
            displayName: repoDisplayName,
            imageUrl: null,
            isFork: !!repo.isFork,
            isArchived: false,
            isPublic: isPublic,
            org: {
                connect: {
                    id: SINGLE_TENANT_ORG_ID,
                },
            },
            connections: {
                create: {
                    connectionId: connectionId,
                }
            },
            metadata: {
                gitConfig: {
                    'zoekt.web-url-type': 'azuredevops',
                    'zoekt.web-url': webUrl,
                    'zoekt.name': repoName,
                    'zoekt.archived': marshalBool(false),
                    'zoekt.fork': marshalBool(!!repo.isFork),
                    'zoekt.public': marshalBool(isPublic),
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
        warnings,
    };
}
