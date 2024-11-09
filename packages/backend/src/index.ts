import { ArgumentParser } from "argparse";
import { mkdir, readFile } from 'fs/promises';
import { existsSync, watch } from 'fs';
import path from 'path';
import { SourcebotConfigurationSchema } from "./schemas/v2.js";
import { getGitHubReposFromConfig } from "./github.js";
import { getGitLabReposFromConfig } from "./gitlab.js";
import { getGiteaReposFromConfig } from "./gitea.js";
import { AppContext, LocalRepository, GitRepository, Repository } from "./types.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { createRepository, Database, loadDB, updateRepository } from './db.js';
import { arraysEqualShallow, isRemotePath, measure } from "./utils.js";
import { REINDEX_INTERVAL_MS, RESYNC_CONFIG_INTERVAL_MS } from "./constants.js";
import stripJsonComments from 'strip-json-comments';
import { indexGitRepository, indexLocalRepository } from "./zoekt.js";
import { getLocalRepoFromConfig, initLocalRepoFileWatchers } from "./local.js";
import { captureEvent } from "./posthog.js";

const logger = createLogger('main');

const parser = new ArgumentParser({
    description: "Sourcebot backend tool",
});

type Arguments = {
    configPath: string;
    cacheDir: string;
}

const syncGitRepository = async (repo: GitRepository, ctx: AppContext) => {
    if (existsSync(repo.path)) {
        logger.info(`Fetching ${repo.id}...`);

        const { durationMs } = await measure(() => fetchRepository(repo, ({ method, stage , progress}) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));

        process.stdout.write('\n');
        logger.info(`Fetched ${repo.id} in ${durationMs / 1000}s`);

    } else {
        logger.info(`Cloning ${repo.id}...`);

        const { durationMs } = await measure(() => cloneRepository(repo, ({ method, stage, progress }) => {
            logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
        }));

        process.stdout.write('\n');
        logger.info(`Cloned ${repo.id} in ${durationMs / 1000}s`);
    }

    logger.info(`Indexing ${repo.id}...`);
    const { durationMs } = await measure(() => indexGitRepository(repo, ctx));
    logger.info(`Indexed ${repo.id} in ${durationMs / 1000}s`);
}

const syncLocalRepository = async (repo: LocalRepository, ctx: AppContext, signal?: AbortSignal) => {
    logger.info(`Indexing ${repo.id}...`);
    const { durationMs } = await measure(() => indexLocalRepository(repo, ctx, signal));
    logger.info(`Indexed ${repo.id} in ${durationMs / 1000}s`);
}

export const isRepoReindxingRequired = (previous: Repository, current: Repository) => {

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
            case 'local': {
                const repo = getLocalRepoFromConfig(repoConfig, ctx);
                configRepos.push(repo);
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
            const isReindexingRequired = isRepoReindxingRequired(existingRepo, newRepo);
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

(async () => {
    parser.add_argument("--configPath", {
        help: "Path to config file",
        required: true,
    });

    parser.add_argument("--cacheDir", {
        help: "Path to .sourcebot cache directory",
        required: true,
    });
    const args = parser.parse_args() as Arguments;

    if (!isRemotePath(args.configPath) && !existsSync(args.configPath)) {
        console.error(`Config file ${args.configPath} does not exist`);
        process.exit(1);
    }

    const cacheDir = args.cacheDir;
    const reposPath = path.join(cacheDir, 'repos');
    const indexPath = path.join(cacheDir, 'index');

    if (!existsSync(reposPath)) {
        await mkdir(reposPath, { recursive: true });
    }
    if (!existsSync(indexPath)) {
        await mkdir(indexPath, { recursive: true });
    }

    const context: AppContext = {
        indexPath,
        reposPath,
        cachePath: cacheDir,
        configPath: args.configPath,
    }

    const db = await loadDB(context);
    
    let abortController = new AbortController();
    let isSyncing = false;
    const _syncConfig = async () => {
        if (isSyncing) {
            abortController.abort();
            abortController = new AbortController();
        }

        logger.info(`Syncing configuration file ${args.configPath} ...`);
        isSyncing = true;

        try {
            const { durationMs } = await measure(() => syncConfig(args.configPath, db, abortController.signal, context))
            logger.info(`Synced configuration file ${args.configPath} in ${durationMs / 1000}s`);
            isSyncing = false;
        } catch (err: any) {
            if (err.name === "AbortError") {
                // @note: If we're aborting, we don't want to set isSyncing to false
                // since it implies another sync is in progress.
            } else {
                isSyncing = false;
                logger.error(`Failed to sync configuration file ${args.configPath} with error:`);
                console.log(err);
            }
        }

        const localRepos = Object.values(db.data.repos).filter(repo => repo.vcs === 'local');
        initLocalRepoFileWatchers(localRepos, async (repo, signal) => {
            logger.info(`Change detected to local repository ${repo.id}. Re-syncing...`);
            await syncLocalRepository(repo, context, signal);
            await db.update(({ repos }) => repos[repo.id].lastIndexedDate = new Date().toUTCString());
        });
    }

    // Re-sync on file changes if the config file is local
    if (!isRemotePath(args.configPath)) {
        watch(args.configPath, () => {
            logger.info(`Config file ${args.configPath} changed. Re-syncing...`);
            _syncConfig();
        });
    }

    // Re-sync every 24 hours
    setInterval(() => {
        logger.info(`Re-syncing configuration file ${args.configPath}`);
        _syncConfig();
    }, RESYNC_CONFIG_INTERVAL_MS);

    // Sync immediately on startup
    await _syncConfig();

    while (true) {
        const repos = db.data.repos;

        for (const [_, repo] of Object.entries(repos)) {
            const lastIndexed = repo.lastIndexedDate ? new Date(repo.lastIndexedDate) : new Date(0);

            if (
                repo.isStale ||
                lastIndexed.getTime() > Date.now() - REINDEX_INTERVAL_MS
            ) {
                continue;
            }

            try {
                if (repo.vcs === 'git') {
                    await syncGitRepository(repo, context);
                } else if (repo.vcs === 'local') {
                    await syncLocalRepository(repo, context);
                }
            } catch (err: any) {
                // @todo : better error handling here..
                logger.error(err);
                continue;
            }
            
            await db.update(({ repos }) => repos[repo.id].lastIndexedDate = new Date().toUTCString());
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
})();
