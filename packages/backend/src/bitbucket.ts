import { createBitbucketCloudClient } from "@coderabbitai/bitbucket/cloud";
import { createBitbucketServerClient } from "@coderabbitai/bitbucket/server";
import type { ClientOptions } from "openapi-fetch";
import { toBase64 } from "@coderabbitai/bitbucket";
import {
    SchemaBranch as CloudBranch,
    SchemaProject as CloudProject,
    SchemaRepository as CloudRepository,
    SchemaTag as CloudTag,
    SchemaWorkspace as CloudWorkspace
} from "@coderabbitai/bitbucket/cloud/openapi";
import {
    SchemaRestBranch as ServerBranch,
    SchemaProject as ServerProject,
    SchemaRepository as ServerRepository,
    SchemaRestTag as ServerTag
} from "@coderabbitai/bitbucket/server/openapi";
import { BitbucketConfig } from "./schemas/v2.js";
import {
    excludeArchivedRepos,
    excludeForkedRepos,
    excludeReposByName,
    getTokenFromConfig,
    marshalBool,
    measure
} from "./utils.js";
import { createLogger } from "./logger.js";
import { AppContext, GitRepository } from "./types.js";
import path from 'path';
import micromatch from "micromatch";

const logger = createLogger('Bitbucket');
const BITBUCKET_CLOUD_GIT = 'https://bitbucket.org';
const BITBUCKET_CLOUD_API = 'https://api.bitbucket.org/2.0';
const SERVER_API_PATH = 'rest/api/latest';
const CLOUD = 'cloud';
const SERVER = 'server';
const CONTENT_TYPE = 'application/json';
const UNKNOWN = 'unknown';
const RETRY_TIME = 2000; // ms

interface Repo {
    // these two are set when the Repo object is initialized in newRepo()
    workspace: string;
    project: string;
    // these four are set by the per-type mapping functions
    name: string;
    isArchived: boolean;
    isFork: boolean;
    isPublic: boolean;
    // these four are set in common processing
    user: string;
    token: string;
    stars: number;
    forks: number;
};

interface BitbucketClient {
    serverType: string;
    token: string;
    user: string | undefined; // not used for server auth
    apiClient: any; // can't figure out a better way to declare this
    baseUrl: string; // API URL
    gitUrl: string; // git repo URL
    // methods
    getPaginated: (client: BitbucketClient, path: string) => Promise<object[]>;
    getWorkspaces: (client: BitbucketClient) => Promise<string[]>;
    getProjects: (client: BitbucketClient, workspace: string) => Promise<string[]>;
    getRepos: (client: BitbucketClient, workspace: string, project: string) => Promise<Repo[]>;
    countForks: (client: BitbucketClient, repo: Repo) => Promise<number>;
    countWatchers: (client: BitbucketClient, repo: Repo) => Promise<number>;
    getBranches: (client: BitbucketClient, repo: string) => Promise<string[]>;
    getTags: (client: BitbucketClient, repo: string) => Promise<string[]>;
}

export const getBitbucketReposFromConfig = async (config: BitbucketConfig, ctx: AppContext) => {
    const serverType = config.serverType ? config.serverType : CLOUD;
    var client: BitbucketClient;

    if (serverType === SERVER) {
        client = serverClient(config, ctx);
    } else {
        client = cloudClient(config, ctx);
    }

    logger.info(`Base URL: ${client.baseUrl}`);
    logger.info(`Git URL: ${client.gitUrl}`);

    let foundRepos: Repo[] = [];

    const { durationMs: workspaceMs, data: workspaces } = await measure(() => client.getWorkspaces(client));
    logger.info(`Found ${workspaces.length} workspaces in ${workspaceMs} ms`);

    for (const workspace of workspaces) {
        const { durationMs: projectMs, data: projects } = await measure(() => client.getProjects(client, workspace));
        logger.info(`  Found ${projects.length} projects in ${workspace} in ${projectMs} ms`);

        for (const project of projects) {
            const { durationMs, data: repos } = await measure(() => client.getRepos(client, workspace, project));
            logger.info(`    Found ${repos.length} repos in ${project} in ${durationMs} ms`);

            for (const repo of repos) {
                logger.debug('REPO ' + JSON.stringify(repo));

                var stars: number = 0;
                var forks: number = 0;

                // counting these can cause rate limiting
                if (config.countMisc) {
                    // not sure the suggested mapping of watchers to stars makes much sense
                    const { durationMs: starMs, data: foundStars } = await measure(() => client.countWatchers(client, repo));
                    stars = foundStars
                    logger.info(`    Found ${stars} watchers for ${repo.name} in ${starMs} ms`);
                    const { durationMs: forkMs, data: foundForks } = await measure(() => client.countForks(client, repo));
                    forks = foundForks
                    logger.info(`    Found ${forks} forks for ${repo.name} in ${forkMs} ms`);
                }

                repo.forks = forks;
                repo.stars = stars;
                repo.token = client.token ? client.token : UNKNOWN;
                repo.user = client.user ? client.user : UNKNOWN;

                foundRepos.push(repo);
            }
        }
    };

    let repos: GitRepository[] = foundRepos
        .map((project) => {
            const repoId = `${client.gitUrl}/${project.workspace}/${project.name}`;
            const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`))
            const webUrl = new URL(repoId); // we don't want user & token here

            const cloneUrl = new URL(repoId);
            if (project.user) {
                cloneUrl.username = project.user;
            }
            if (project.token) {
                cloneUrl.password = project.token;
            }

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
        if (!!config.exclude.archived) {
            repos = excludeArchivedRepos(repos, logger);
        }

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
                logger.debug(`  Fetching branches for repo ${repo.name}...`);
                let { durationMs, data: branches } = await measure(() => client.getBranches(client, repo.name));
                logger.info(`  Found ${branches.length} branches in repo ${repo.name} in ${durationMs} ms`);

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
                logger.debug(`  Fetching tags for repo ${repo.name}...`);
                let { durationMs, data: tags } = await measure(() => client.getTags(client, repo.name));
                logger.info(`  Found ${tags.length} tags in repo ${repo.name} in ${durationMs} ms`);

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

//
// cloud support
//
function cloudClient(config: BitbucketConfig, ctx: AppContext): BitbucketClient {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;
    const user = config.user ? config.user : undefined;
    const basic = toBase64(`${user}:${token}`);

    const clientOptions: ClientOptions = {
        baseUrl: BITBUCKET_CLOUD_API,
        headers: {
            Accept: CONTENT_TYPE,
            Authorization: `Basic ${basic}`,
        },
    };

    const apiClient = createBitbucketCloudClient(clientOptions);
    var client: BitbucketClient = {
        serverType: CLOUD,
        user: user,
        token: token ? token : 'junk',
        apiClient: apiClient,
        baseUrl: BITBUCKET_CLOUD_API,
        gitUrl: BITBUCKET_CLOUD_GIT,
        getPaginated: cloudGetPaginatedResult,
        getWorkspaces: cloudGetWorkspaces,
        getProjects: cloudGetProjects,
        getRepos: cloudGetRepos,
        countForks: cloudCountForks,
        countWatchers: cloudCountWatchers,
        getBranches: cloudGetBranches,
        getTags: cloudGetTags,
    }

    return client;
}

async function cloudGetWorkspaces(client: BitbucketClient): Promise<string[]> {
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, '/workspaces');
    } catch (e) {
        logger.error(`Failed to fetch workspaces.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const workspace = <CloudWorkspace> info[i];
        // we return 'slug' here, since sometimes 'name' doesn't match; no idea why
        if (workspace.slug != null) {
            results.push(workspace.slug);
        }
    }

    logger.debug(`FOUND ${results.length} WORKSPACES`);
    return results;
}

async function cloudGetPaginatedResult(client: BitbucketClient, path: string): Promise<object[]> {
    var results: object[] = [];

    while (true) {
        logger.debug(`URL ${path}`);
        const page = await client.apiClient.GET(path);

        logger.debug('PAGE ' + JSON.stringify(page));
        if (page.error != null) {
            // rate limit?
            await delay(RETRY_TIME);
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

        path = page.data.next.replace(client.baseUrl, '');
    }

    return results;
}

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cloudGetProjects(client: BitbucketClient, workspace: string): Promise<string[]> {
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, `/workspaces/${workspace}/projects`);
    } catch (e) {
        logger.error(`Failed to fetch projects for workspace ${workspace}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const proj = <CloudProject> info[i];
        logger.debug('PROJ ' + JSON.stringify(proj));
        if (proj.key != null) {
            results.push(proj.key);
        }
    }

    logger.debug(`  FOUND ${results.length} PROJECTS IN ${workspace}`);
    return results;
}

async function cloudGetRepos(client: BitbucketClient, workspace: string, project: string): Promise<Repo[]> {
    var info: object[];
    var results: Repo[] = [];

    try {
        info = await client.getPaginated(client, `/repositories/${workspace}?q=project.key="${project}"`);
    } catch (e) {
        logger.error(`Failed to fetch repos for workspace ${workspace}/${project}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const repo = <CloudRepository> info[i];
        results.push(mapCloudRepo(repo, workspace, project));
    }

    logger.debug(`    FOUND ${results.length} REPOS IN ${workspace}/${project}`);
    return results;
}

function mapCloudRepo(orig: CloudRepository, workspace: string, project: string): Repo {
    var repo: Repo = newRepo(workspace, project);

    repo.name = orig.name ? orig.name : UNKNOWN;
    repo.isArchived = false; // no archiving in cloud
    repo.isFork = orig.parent != null;
    repo.isPublic = !orig.is_private;

    return repo;
}

function newRepo(workspace: string, project: string): Repo {
    var repo: Repo = {
        name: UNKNOWN,
        isArchived: false,
        isFork: false,
        isPublic: false,
        project: project,
        workspace: workspace,
        user: UNKNOWN,
        token: UNKNOWN,
        stars: 0,
        forks: 0,
    };

    return repo;
}

async function cloudGetBranches(client: BitbucketClient, repo: string): Promise<string[]> {
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, `/repositories/${repo}/refs/branches`);
    } catch (e) {
        logger.error(`Failed to fetch branches for repo ${repo}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const branch = <CloudBranch> info[i];
        results.push(branch.name ? branch.name : UNKNOWN);
    }

    logger.debug(`      FOUND ${results.length} BRANCHES IN ${repo}`);
    return results;
}

async function cloudGetTags(client: BitbucketClient, repo: string): Promise<string[]> {
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, `/repositories/${repo}/refs/tags`);
    } catch (e) {
        logger.error(`Failed to fetch tags for repo ${repo}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const tag = <CloudTag> info[i];
        results.push(tag.name ? tag.name : UNKNOWN);
    }

    logger.debug(`      FOUND ${results.length} TAGS IN ${repo}`);
    return results;
}

async function cloudCountForks(client: BitbucketClient, repo: Repo): Promise<number> {
    var name: string = `${repo.workspace}/${repo.name}`
    var info: object[];

    try {
        info = await client.getPaginated(client, `/repositories/${name}/forks`);
    } catch (e) {
        logger.error(`Failed to count forks for repo ${name}.`, e);
        return 0;
    }

    logger.debug(`      FOUND ${info.length} FORKS FOR ${name}`);
    return info.length;
}

async function cloudCountWatchers(client: BitbucketClient, repo: Repo): Promise<number> {
    var name: string = `${repo.workspace}/${repo.name}`
    var info: object[];

    try {
        info = await client.getPaginated(client, `/repositories/${name}/watchers`);
    } catch (e) {
        logger.error(`Failed to count watchers for repo ${name}.`, e);
        return 0;
    }

    logger.debug(`      FOUND ${info.length} WATCHERS FOR ${name}`);
    return info.length;
}

//
// server support
//
function serverClient(config: BitbucketConfig, ctx: AppContext): BitbucketClient {
    const token = config.token ? getTokenFromConfig(config.token, ctx) : undefined;
    const url = config.url ? config.url : 'https://junk';

    const clientOptions: ClientOptions = {
        baseUrl: `${url}/${SERVER_API_PATH}`,
        headers: {
            Accept: CONTENT_TYPE,
            Authorization: `Bearer ${token}`,
        },
    };

    const apiClient = createBitbucketServerClient(clientOptions);
    var client: BitbucketClient = {
        serverType: SERVER,
        user: '',
        token: token ? token : 'junk',
        apiClient: apiClient,
        baseUrl: `${url}/${SERVER_API_PATH}`,
        gitUrl: `${url}`,
        getPaginated: serverGetPaginatedResult,
        getWorkspaces: serverGetWorkspaces,
        getProjects: serverGetProjects,
        getRepos: serverGetRepos,
        countForks: serverCountForks,
        countWatchers: serverCountWatchers,
        getBranches: serverGetBranches,
        getTags: serverGetTags,
    };

    return client;
}

// no workspace support in server as far as I can see
async function serverGetWorkspaces(_: BitbucketClient): Promise<string[]> {
    return ['default'];
}

async function serverGetPaginatedResult(client: BitbucketClient, path: string): Promise<object[]> {
    var results: object[] = [];
    const origPath: string = path;

    while (true) {
        logger.debug(`URL ${path}`);
        const page = await client.apiClient.GET(path);

        logger.debug('PAGE ' + JSON.stringify(page));
        if (page.error != null) {
            // rate limit?
            await delay(RETRY_TIME);
            continue;
        }

        if (page.data == null || page.data.values == null || page.data.values.length === 0) {
            break;
        }

        for (var i = 0; i < page.data.values.length; i++) {
            results.push(page.data.values[i]);
        }

        // mock testing with prism can return a negative result
        if (page.data?.nextPageStart == null || page.data?.nextPageStart <= 0) {
            break;
        }

        path = origPath + `?start=${page.data.nextPageStart}`;
    }

    return results;
}

async function serverGetProjects(client: BitbucketClient, _: string): Promise<string[]> {
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, '/projects');
    } catch (e) {
        logger.error(`Failed to fetch projects.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const proj = <ServerProject> info[i];
        logger.debug('PROJ ' + JSON.stringify(proj));
        if (proj.key != null) {
            results.push(proj.key);
        }
    }

    logger.debug(`  FOUND ${results.length} PROJECTS`);
    return results;
}

async function serverGetRepos(client: BitbucketClient, _: string, project: string): Promise<Repo[]> {
    var info: object[];
    var results: Repo[] = [];

    try {
        info = await client.getPaginated(client, `/projects/${project}/repos`);
    } catch (e) {
        logger.error(`Failed to fetch repos for project ${project}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const repo = <ServerRepository> info[i];
        results.push(mapServerRepo(repo, project, project));
    }

    logger.debug(`    FOUND ${results.length} REPOS IN ${project}`);
    return results;
}

function mapServerRepo(orig: ServerRepository, workspace: string, project: string): Repo {
    // server has no workspace; set workspace to project
    var repo: Repo = newRepo(project, project);

    repo.name = orig.name ? orig.name : UNKNOWN;
    repo.isArchived = orig.archived ? orig.archived : false;
    repo.isFork = false;
    repo.isPublic = orig.public ? orig.public : false;

    return repo;
}

async function serverGetBranches(client: BitbucketClient, repo: string): Promise<string[]> {
    const comps: string[] = repo.split('/');
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, `/projects/${comps[0]}/repos/${comps[1]}/branches`);
    } catch (e) {
        logger.error(`Failed to fetch branches for repo ${repo}.`, e);
        return results;
    }
    for (var i = 0; i < info.length; i++) {
        const branch = <ServerBranch> info[i];
        results.push(branch.displayId ? branch.displayId : UNKNOWN);
    }

    logger.debug(`      FOUND ${results.length} BRANCHES IN ${repo}`);
    return results;
}

async function serverGetTags(client: BitbucketClient, repo: string): Promise<string[]> {
    const comps: string[] = repo.split('/');
    var info: object[];
    var results: string[] = [];

    try {
        info = await client.getPaginated(client, `/projects/${comps[0]}/repos/${comps[1]}/tags`);
    } catch (e) {
        logger.error(`Failed to fetch tags for repo ${repo}.`, e);
        return results;
    }

    for (var i = 0; i < info.length; i++) {
        const tag = <ServerTag> info[i];
        results.push(tag.displayId ? tag.displayId : UNKNOWN);
    }

    logger.debug(`      FOUND ${results.length} TAGS IN ${repo}`);
    return results;
}

async function serverCountForks(client: BitbucketClient, repo: Repo): Promise<number> {
    return 0;
}

async function serverCountWatchers(client: BitbucketClient, repo: Repo): Promise<number> {
    return 0;
}
