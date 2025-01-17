import { GitRepository, AppContext } from './types.js';
import { simpleGit, SimpleGitProgressEvent } from 'simple-git';
import { createLogger } from './logger.js';
import { GitConfig } from './schemas/v2.js';
import path from 'path';

const logger = createLogger('git');

export const cloneRepository = async (cloneURL: string, path: string, gitConfig?: Record<string, string>, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    const configParams = Object.entries(gitConfig ?? {}).flatMap(
        ([key, value]) => ['--config', `${key}=${value}`]
    );

    await git.clone(
        cloneURL,
        path,
        [
            "--bare",
            ...configParams
        ]
    );

    await git.cwd({
        path,
    }).addConfig("remote.origin.fetch", "+refs/heads/*:refs/heads/*");
}


export const fetchRepository = async (path: string, onProgress?: (event: SimpleGitProgressEvent) => void) => {
    const git = simpleGit({
        progress: onProgress,
    });

    await git.cwd({
        path: path,
    }).fetch(
        "origin",
        [
            "--prune",
            "--progress"
        ]
    );
}

const isValidGitRepo = async (url: string): Promise<boolean> => {
    const git = simpleGit();
    try {
        await git.listRemote([url]);
        return true;
    } catch (error) {
        logger.debug(`Error checking if ${url} is a valid git repo: ${error}`);
        return false;
    }
}

const stripProtocolAndGitSuffix = (url: string): string => {
    return url.replace(/^[a-zA-Z]+:\/\//, '').replace(/\.git$/, '');
}

const getRepoNameFromUrl = (url: string): string => {
    const strippedUrl = stripProtocolAndGitSuffix(url);
    return strippedUrl.split('/').slice(-2).join('/');
}

export const getGitRepoFromConfig = async (config: GitConfig, ctx: AppContext) => {
    const repoValid = await isValidGitRepo(config.url);
    if (!repoValid) {
        logger.error(`Git repo provided in config with url ${config.url} is not valid`);
        return null;
    }

    const cloneUrl = config.url;
    const repoId = stripProtocolAndGitSuffix(cloneUrl);
    const repoName = getRepoNameFromUrl(config.url);
    const repoPath = path.resolve(path.join(ctx.reposPath, `${repoId}.git`));
    const repo: GitRepository = {
        vcs: 'git',
        id: repoId,
        name: repoName,
        path: repoPath,
        isStale: false,
        cloneUrl: cloneUrl,
        branches: [],
        tags: [],
    }

    if (config.revisions) {
        if (config.revisions.branches) {
            const branchGlobs = config.revisions.branches;
            const git = simpleGit();
            const branchList = await git.listRemote(['--heads', cloneUrl]);
            const branches = branchList
                .split('\n')
                .map(line => line.split('\t')[1])
                .filter(Boolean)
                .map(branch => branch.replace('refs/heads/', ''));

            repo.branches = branches.filter(branch => 
                branchGlobs.some(glob => new RegExp(glob).test(branch))
            );
        }

        if (config.revisions.tags) {
            const tagGlobs = config.revisions.tags;
            const git = simpleGit();
            const tagList = await git.listRemote(['--tags', cloneUrl]);
            const tags = tagList
                .split('\n')
                .map(line => line.split('\t')[1])
                .filter(Boolean)
                .map(tag => tag.replace('refs/tags/', ''));

            repo.tags = tags.filter(tag => 
                tagGlobs.some(glob => new RegExp(glob).test(tag))
            );
        }
    }

    return repo;
}