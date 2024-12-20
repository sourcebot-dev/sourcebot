import { readFile, rm } from 'fs/promises';
import { existsSync, watch } from 'fs';
import { SourcebotConfigurationSchema } from "./schemas/v2.js";
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig } from "./gitlab.js";
import { getGiteaReposFromConfig } from "./gitea.js";
import { getGerritReposFromConfig } from "./gerrit.js";
import { getBitbucketReposFromConfig } from "./bitbucket.js";
import { AppContext, LocalRepository, GitRepository, Repository, Settings } from "./types.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { createRepository, Database, loadDB, updateRepository, updateSettings } from './db.js';
import { arraysEqualShallow, isRemotePath, measure } from "./utils.js";
import { DEFAULT_SETTINGS } from "./constants.js";
import stripJsonComments from 'strip-json-comments';
import { indexGitRepository, indexLocalRepository } from "./zoekt.js";
import { getLocalRepoFromConfig, initLocalRepoFileWatchers } from "./local.js";
import { captureEvent } from "./posthog.js";
import { glob } from 'glob';
import path from 'path';

const logger = createLogger('main');

const syncGitRepository = async (repo: GitRepository, settings: Settings, ctx: AppContext) => {
    let fetchDuration_s: number | undefined = undefined;
    let cloneDuration_s: number | undefined = undefined;

    if (existsSync(repo.path)) {
        logger.info(`Fetching ${repo.id}...`);

        const { durationMs } = await measure(() => fetchRepository(repo, ({ method, stage , progress}) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));
        fetchDuration_s = durationMs / 1000;

        process.stdout.write('\n');
        logger.info(`Fetched ${repo.id} in ${fetchDuration_s}s`);

    } else {
        logger.info(`Cloning ${repo.id}...`);

        const { durationMs } = await measure(() => cloneRepository(repo, ({ method, stage, progress }) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));
        cloneDuration_s = durationMs / 1000;

        process.stdout.write('\n');
        logger.info(`Cloned ${repo.id} in ${cloneDuration_s}s`);
    }

    logger.info(`Indexing ${repo.id}...`);
    const { durationMs } = await measure(() => indexGitRepository(repo, settings, ctx));
    const indexDuration_s = durationMs / 1000;
    logger.info(`Indexed ${repo.id} in ${indexDuration_s}s`);

    return {
        fetchDuration_s,
        cloneDuration_s,
        indexDuration_s,
    }
}

const syncLocalRepository = async (repo: LocalRepository, settings: Settings, ctx: AppContext, signal?: AbortSignal) => {
    logger.info(`Indexing ${repo.id}...`);
    const { durationMs } = await measure(() => indexLocalRepository(repo, settings, ctx, signal));
    const indexDuration_s = durationMs / 1000;
    logger.info(`Indexed ${repo.id} in ${indexDuration_s}s`);
    return {
        indexDuration_s,
    }
}

export const deleteStaleRepository = async (repo: Repository, db: Database, ctx: AppContext) => {
    logger.info(`Deleting stale repository ${repo.id}:`);

    // Delete the checked out git repository (if applicable)
    if (repo.vcs === "git" && existsSync(repo.path)) {
        logger.info(`\tDeleting git directory ${repo.path}...`);
        await rm(repo.path, {
            recursive: true,
        });
    }

    // Delete all .zoekt index files
    {
        // .zoekt index files are named with the repository name,
        // index version, and shard number. Some examples:
        //
        //   git repos:
        //   github.com%2Fsourcebot-dev%2Fsourcebot_v16.00000.zoekt
        //   gitlab.com%2Fmy-org%2Fmy-project.00000.zoekt
        //
        //   local repos:
        //   UnrealEngine_v16.00000.zoekt
        //   UnrealEngine_v16.00001.zoekt
        //   ...
        //   UnrealEngine_v16.00016.zoekt
        //
        // Notice that local repos are named with the repository basename and
        // git repos are named with the query-encoded repository name. Form a
        // glob pattern with the correct prefix & suffix to match the correct
        // index file(s) for the repository.
        //
        // @see : https://github.com/sourcegraph/zoekt/blob/c03b77fbf18b76904c0e061f10f46597eedd7b14/build/builder.go#L348
        const indexFilesGlobPattern = (() => {
            switch (repo.vcs) {
                case 'git':
                    return `${encodeURIComponent(repo.id)}*.zoekt`;
                case 'local':
                    return `${path.basename(repo.path)}*.zoekt`;
            }
        })();

        const indexFiles = await glob(indexFilesGlobPattern, {
            cwd: ctx.indexPath,
            absolute: true
        });

        await Promise.all(indexFiles.map((file) => {
            if (!existsSync(file)) {
                return;
            }

            logger.info(`\tDeleting index file ${file}...`);
            return rm(file);
        }));
    }

    // Delete db entry
    logger.info(`\tDeleting db entry...`);
    await db.update(({ repos }) => {
        delete repos[repo.id];
    });
    
    logger.info(`Deleted stale repository ${repo.id}`);

    captureEvent('repo_deleted', {
        vcs: repo.vcs,
        codeHost: repo.codeHost,
    })
}

/**
 * Certain configuration changes (e.g., a branch is added) require
 * a reindexing of the repository.
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

/**
 * Certain settings changes (e.g., the file limit size is changed) require
 * a reindexing of _all_ repositories.
 */
export const isAllRepoReindexingRequired = (previous: Settings, current: Settings) => {
    return (
        previous?.maxFileSize !== current?.maxFileSize
    )
}

const syncConfig = async (configPath: string, db: Database, signal: AbortSignal, ctx: AppContext) => {
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
    const _isAllRepoReindexingRequired = isAllRepoReindexingRequired(db.data.settings, updatedSettings);
    await updateSettings(updatedSettings, db);

    // Fetch all repositories from the config file
    let configRepos: Repository[] = [];
    for (const repoConfig of config.repos ?? []) {
        switch (repoConfig.type) {
            case 'github': {
                const gitHubRepos = await getGitHubReposFromConfig(repoConfig, signal, ctx);
                configRepos.push(...gitHubRepos);
                break;
            }
            case 'gitlab': {
                const gitLabRepos = await getGitLabReposFromConfig(repoConfig, ctx);
                configRepos.push(...gitLabRepos);
                break;
            }
            case 'gitea': {
                const giteaRepos = await getGiteaReposFromConfig(repoConfig, ctx);
                configRepos.push(...giteaRepos);
                break;
            }
            case 'gerrit': {
                const gerritRepos = await getGerritReposFromConfig(repoConfig, ctx);
                configRepos.push(...gerritRepos);
                break;
            }
            case 'local': {
                const repo = getLocalRepoFromConfig(repoConfig, ctx);
                configRepos.push(repo);
                break;
            }
            case 'bitbucket': {
                const bitbucketRepos = await getBitbucketReposFromConfig(repoConfig, ctx);
                configRepos.push(...bitbucketRepos);
                break;
            }
        }
    }

    // De-duplicate on id
    configRepos.sort((a, b) => {
        return a.id.localeCompare(b.id);
    });
    configRepos = configRepos.filter((item, index, self) => {
        if (index === 0) return true;
        if (item.id === self[index - 1].id) {
            logger.debug(`Duplicate repository ${item.id} found in config file.`);
            return false;
        }
        return true;
    });

    logger.info(`Discovered ${configRepos.length} unique repositories from config.`);

    // Merge the repositories into the database
    for (const newRepo of configRepos) {
        if (newRepo.id in db.data.repos) {
            const existingRepo = db.data.repos[newRepo.id];
            const isReindexingRequired = _isAllRepoReindexingRequired || isRepoReindexingRequired(existingRepo, newRepo);
            if (isReindexingRequired) {
                logger.info(`Marking ${newRepo.id} for reindexing due to configuration change.`);
            }
            await updateRepository(existingRepo.id, {
                ...newRepo,
                ...(isReindexingRequired ? {
                    lastIndexedDate: undefined,
                }: {})
            }, db);
        } else {
            await createRepository(newRepo, db);

            captureEvent("repo_created", {
                vcs: newRepo.vcs,
                codeHost: newRepo.codeHost,
            });
        }
    }

    // Find repositories that are in the database, but not in the configuration file
    {
        const a = configRepos.map(repo => repo.id);
        const b = Object.keys(db.data.repos);
        const diff = b.filter(x => !a.includes(x));

        for (const id of diff) {
            await db.update(({ repos }) => {
                const repo = repos[id];
                if (repo.isStale) {
                    return;
                }

                logger.warn(`Repository ${id} is no longer listed in the configuration file or was not found. Marking as stale.`);
                repo.isStale = true;
            });
        }
    }
}

export const main = async (context: AppContext) => {
    const db = await loadDB(context);
    
    let abortController = new AbortController();
    let isSyncing = false;
    const _syncConfig = async () => {
        if (isSyncing) {
            abortController.abort();
            abortController = new AbortController();
        }

        logger.info(`Syncing configuration file ${context.configPath} ...`);
        isSyncing = true;

        try {
            const { durationMs } = await measure(() => syncConfig(context.configPath, db, abortController.signal, context))
            logger.info(`Synced configuration file ${context.configPath} in ${durationMs / 1000}s`);
            isSyncing = false;
        } catch (err: any) {
            if (err.name === "AbortError") {
                // @note: If we're aborting, we don't want to set isSyncing to false
                // since it implies another sync is in progress.
            } else {
                isSyncing = false;
                logger.error(`Failed to sync configuration file ${context.configPath} with error:`);
                console.log(err);
            }
        }

        const localRepos = Object.values(db.data.repos).filter(repo => repo.vcs === 'local');
        initLocalRepoFileWatchers(localRepos, async (repo, signal) => {
            logger.info(`Change detected to local repository ${repo.id}. Re-syncing...`);
            await syncLocalRepository(repo, db.data.settings, context, signal);
            await db.update(({ repos }) => repos[repo.id].lastIndexedDate = new Date().toUTCString());
        });
    }

    // Re-sync on file changes if the config file is local
    if (!isRemotePath(context.configPath)) {
        watch(context.configPath, () => {
            logger.info(`Config file ${context.configPath} changed. Re-syncing...`);
            _syncConfig();
        });
    }

    // Re-sync at a fixed interval
    setInterval(() => {
        _syncConfig();
    }, db.data.settings.resyncInterval);

    // Sync immediately on startup
    await _syncConfig();

    while (true) {
        const repos = db.data.repos;

        for (const [_, repo] of Object.entries(repos)) {
            const lastIndexed = repo.lastIndexedDate ? new Date(repo.lastIndexedDate) : new Date(0);

            if (repo.isStale) {
                if (db.data.settings.autoDeleteStaleRepos) {
                    await deleteStaleRepository(repo, db, context);
                } else {
                    // skip deletion...
                }
                continue;
            }

            if (lastIndexed.getTime() > (Date.now() - db.data.settings.reindexInterval)) {
                continue;
            }

            try {
                let indexDuration_s: number | undefined;
                let fetchDuration_s: number | undefined;
                let cloneDuration_s: number | undefined;

                if (repo.vcs === 'git') {
                    const stats = await syncGitRepository(repo, db.data.settings, context);
                    indexDuration_s = stats.indexDuration_s;
                    fetchDuration_s = stats.fetchDuration_s;
                    cloneDuration_s = stats.cloneDuration_s;
                } else if (repo.vcs === 'local') {
                    const stats = await syncLocalRepository(repo, db.data.settings, context);
                    indexDuration_s = stats.indexDuration_s;
                }

                captureEvent('repo_synced', {
                    vcs: repo.vcs,
                    codeHost: repo.codeHost,
                    indexDuration_s,
                    fetchDuration_s,
                    cloneDuration_s,
                });
            } catch (err: any) {
                // @todo : better error handling here..
                logger.error(err);
                continue;
            }
            
            await db.update(({ repos }) => repos[repo.id].lastIndexedDate = new Date().toUTCString());
        }

        await new Promise(resolve => setTimeout(resolve, 1000));

    }
}
