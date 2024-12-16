import { createBitbucketCloudClient } from "@coderabbitai/bitbucket/cloud";
import { toBase64 } from "@coderabbitai/bitbucket";
import { SchemaBranch, SchemaProject, SchemaRepository, SchemaTag, SchemaWorkspace } from "@coderabbitai/bitbucket/cloud/openapi";
import { BitbucketConfig } from "./schemas/v2.js";
import { excludeArchivedRepos, excludeForkedRepos, excludeReposByName, excludeReposByTopic, getTokenFromConfig, includeReposByTopic, marshalBool, measure } from "./utils.js";
import { createLogger } from "./logger.js";
import { AppContext, GitRepository } from "./types.js";
import path from 'path';
import micromatch from "micromatch";

const logger = createLogger('Bitbucket');
const BITBUCKET_CLOUD_HOSTNAME = 'bitbucket.org'; // note, not 'api.bitbucket.org'
const BITBUCKET_CLOUD_API = 'https://api.bitbucket.org/2.0';

interface Repo {
    workspace: string;
    project: string;
    name: string;
    isFork: boolean;
    isArchived: boolean;
    isPublic: boolean;
    user: string;
    token: string;
    stars: number;
    forks: number;
};

export const getBitbucketReposFromConfig = async (config: BitbucketConfig, ctx: AppContext) => {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;
    const user = config.user ? config.user : undefined;
    const basic = toBase64(user + ':' + token);
    const url = config.url ? config.url : BITBUCKET_CLOUD_API;

    logger.debug('BASE URL ' + url);

    const clientOptions = {
        baseUrl: url,
        headers: {
            Accept: 'application/json',
            Authorization: `Basic ${basic}`,
        },
    };

    const client = createBitbucketCloudClient(clientOptions);

    const hostname = config.url ? new URL(config.url).hostname : BITBUCKET_CLOUD_HOSTNAME;

    let foundRepos: Repo[] = [];

    const workspaces = await getWorkspaces(client, url);
    for (const workspace of workspaces) {
        const projects = await getProjects(client, url, workspace);

        for (const project of projects) {
            const repos = await getRepos(client, url, workspace, project);

            for (const repo of repos) {
                logger.debug('REPO ' + JSON.stringify(repo));
                if (repo.name == null) {
                    continue;
                }

                var stars: number = 0;
                var forks: number = 0;

                // counting these can cause rate limiting
                if (config.countMisc) {
                    // not sure the suggested mapping of watchers to stars makes much sense
                    stars = await countWatchers(client, url, `${workspace}/${repo.name}`);
                    forks = await countForks(client, url, `${workspace}/${repo.name}`);
                }

                var repository: Repo = {
                    forks: forks,
                    isArchived: false,
                    isFork: repo.parent != null,
                    isPublic: !repo.is_private,
                    name: repo.name ? repo.name : 'unknown',
                    project: project,
                    stars: stars,
                    token: token ? token : 'unknown',
                    user: user ? user : 'unknown',
                    workspace: workspace,
                };

                foundRepos.push(repository);
            }
        }
    };


    let repos: GitRepository[] = foundRepos
        .map((project) => {
            const repoId = `https://${hostname}/${project.workspace}/${project.name}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`))

            const cloneUrl = new URL(repoId);
            if (token) {
                cloneUrl.username = project.user;
                cloneUrl.password = project.token;
            }
            const webUrl = new URL(repoId); // we don't want user & token here

            return {
                vcs: 'git',
                codeHost: 'bitbucket',
                name: `${project.workspace}/${project.name}`,
                id: repoId,
                cloneUrl: cloneUrl.toString(),
                path: repoPath,
                isStale: false,
                isFork: project.isFork,
                isArchived: project.isArchived,
                gitConfigMetadata: {
                    //
                    // using 'bitbucket-server' lets 'zoekt' generate the correct commit
                    // links -- /commits, not /commit
                    //
                    'zoekt.web-url-type': 'bitbucket-server',
                    'zoekt.web-url': webUrl.toString(),
                    'zoekt.name': repoId,
                    'zoekt.bitbucket-stars': project.stars?.toString() ?? '0',
                    'zoekt.bitbucket-forks': project.forks?.toString() ?? '0',
                    'zoekt.archived': marshalBool(project.isArchived),
                    'zoekt.fork': marshalBool(project.isFork),
                    'zoekt.public': marshalBool(project.isPublic),
                },
                branches: [],
                tags: [],
            } satisfies GitRepository;
        });

    if (config.exclude) {
        if (!!config.exclude.forks) {
            repos = excludeForkedRepos(repos, logger);
        }

        if (config.exclude.workspaces) {
            repos = excludeReposByName(repos, config.exclude.workspaces, logger);
        }

        if (config.exclude.projects) {
            repos = excludeReposByName(repos, config.exclude.projects, logger);
        }
    }

    logger.debug(`Found ${repos.length} total repositories.`);

    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            repos = await Promise.all(repos.map(async (repo) => {
                logger.debug(`Fetching branches for repo ${repo.name}...`);
                let branches = await getBranches(client, url, repo.name);
                logger.debug(`Found ${branches.length} branches in repo ${repo.name}`);

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
                let tags = await getTags(client, url, repo.name);
                logger.debug(`Found ${tags.length} tags in repo ${repo.name}`);

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

async function getWorkspaces(client: any, baseUrl: string): Promise<string[]> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/workspaces');
    var results: string[] = [];

    for (var i = 0; i < info.length; i++) {
        const workspace = <SchemaWorkspace> info[i];
        // we return 'slug' here, since sometimes 'name' doesn't match; no idea why
        if (workspace.slug != null) {
            results.push(workspace.slug);
        }
    }

    logger.info(`FOUND ${results.length} WORKSPACES`);
    return results;
}

async function getPaginatedResult(client: any, baseUrl: string, path: string): Promise<object[]> {
    var results: object[] = [];

    while (true) {
        logger.debug('URL ' + path);
        const page = await client.GET(path);

        logger.debug('PAGE ' + JSON.stringify(page));
        if (page.error != null) {
            // rate limit?
            await delay(2000);
            continue;
        }

        if (page.data == null || page.data.values == null || page.data.values.length == 0) {
            break;
        }

        for (var i = 0; i < page.data.values.length; i++) {
            results.push(page.data.values[i]);
        }

        if (page.data?.next == null) {
            break;
        }

        path = page.data.next.replace(baseUrl, '');
    }

    return results;
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getProjects(client: any, baseUrl: string, workspace: string): Promise<string[]> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/workspaces/' + workspace + '/projects');
    var results: string[] = [];

    for (var i = 0; i < info.length; i++) {
        const proj = <SchemaProject> info[i];
        logger.debug('PROJ ' + JSON.stringify(proj));
        if (proj.key != null) {
            results.push(proj.key);
        }
    }

    logger.info(`  FOUND ${results.length} PROJECTS IN ${workspace}`);
    return results;
}

async function getRepos(client: any, baseUrl: string, workspace: string, project: string): Promise<SchemaRepository[]> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/repositories/' + workspace + '?q=project.key="' + project + '"');
    var results: SchemaRepository[] = [];

    for (var i = 0; i < info.length; i++) {
        const repo = <SchemaRepository> info[i];
        results.push(repo);
    }

    logger.info(`    FOUND ${results.length} REPOS IN ${workspace}/${project}`);
    return results;
}

async function getBranches(client: any, baseUrl: string, repo: string): Promise<string[]> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/repositories/' + repo + '/refs/branches');
    var results: string[] = [];

    for (var i = 0; i < info.length; i++) {
        const branch = <SchemaBranch> info[i];
        results.push(branch.name ? branch.name : 'unknown');
    }

    logger.info(`      FOUND ${results.length} BRANCHES IN ${repo}`);
    return results;
}

async function getTags(client: any, baseUrl: string, repo: string): Promise<string[]> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/repositories/' + repo + '/refs/tags');
    var results: string[] = [];

    for (var i = 0; i < info.length; i++) {
        const tag = <SchemaTag> info[i];
        results.push(tag.name ? tag.name : 'unknown');
    }

    logger.info(`      FOUND ${results.length} TAGS IN ${repo}`);
    return results;
}

async function countForks(client: any, baseUrl: string, repo: string): Promise<number> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/repositories/' + repo + '/forks');

    logger.info(`      FOUND ${info.length} FORKS FOR ${repo}`);
    return info.length;
}

async function countWatchers(client: any, baseUrl: string, repo: string): Promise<number> {
    var info: object[] = await getPaginatedResult(client, baseUrl, '/repositories/' + repo + '/watchers');

    logger.info(`      FOUND ${info.length} WATCHERS FOR ${repo}`);
    return info.length;
}
