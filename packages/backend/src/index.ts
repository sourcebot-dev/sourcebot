import { ArgumentParser } from "argparse";
import { mkdir, readFile } from 'fs/promises';
import { existsSync, watch } from 'fs';
import { exec } from "child_process";
import path from 'path';
import { SourcebotConfigurationSchema } from "./schemas/v2.js";
import { getGitHubReposFromConfig } from "./github.js";
import { AppContext, Repository } from "./types.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { createLogger } from "./logger.js";
import { createOperation, createRepository, Database, loadDB, updateOperation, updateRepository } from './db.js';
import { measure } from "./utils.js";
import { REINDEX_INTERVAL_MS, RESYNC_CONFIG_INTERVAL_MS } from "./constants.js";

const logger = createLogger('main');

const parser = new ArgumentParser({
    description: "Sourcebot backend tool",
});

type Arguments = {
    configPath: string;
    cacheDir: string;
}

const indexRepository = async (repo: Repository, ctx: AppContext) => {
    return new Promise<{ stdout: string, stderr: string }>((resolve, reject) => {
        exec(`zoekt-git-index -index ${ctx.indexPath} ${repo.path}`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve({
                stdout,
                stderr
            });
        })
    });
}

const syncConfig = async (configPath: string, db: Database, signal: AbortSignal, ctx: AppContext) => {
    const configContent = await readFile(configPath, { 
        encoding: 'utf-8',
        signal,
    });

    // @todo: we should validate the configuration file's structure here.
    const config = JSON.parse(configContent) as SourcebotConfigurationSchema;

    // Fetch all repositories from the config file
    let configRepos: Repository[] = [];
    for (const repoConfig of config.repos ?? []) {
        switch (repoConfig.type) {
            case 'github': {
                const gitHubRepos = await getGitHubReposFromConfig(repoConfig, signal, ctx);
                configRepos.push(...gitHubRepos);
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
            await updateRepository(newRepo.id, newRepo, db);
        } else {
            await createRepository(newRepo, db);
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

    if (!existsSync(args.configPath)) {
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
    }

    const db = await loadDB(context);
    
    let abortController = new AbortController();
    let isSyncing = false;
    const _syncConfig = () => {
        if (isSyncing) {
            abortController.abort();
            abortController = new AbortController();
        }

        logger.info(`Syncing configuration file ${args.configPath}`);
        isSyncing = true;
        measure(() => syncConfig(args.configPath, db, abortController.signal, context))
            .then(({ durationMs }) => {
                logger.info(`Synced configuration file ${args.configPath} in ${durationMs / 1000}s`);
                isSyncing = false;
            })
            .catch((err) => {
                if (err.name === "AbortError") {
                    // @note: If we're aborting, we don't want to set isSyncing to false
                    // since it implies another sync is in progress.
                } else {
                    isSyncing = false;
                    logger.error(err);
                }

            });
    }

    // Re-sync on file changes
    watch(args.configPath, () => {
        logger.info(`Config file ${args.configPath} changed. Re-syncing...`);
        _syncConfig();
    });

    // Re-sync every 24 hours
    setInterval(() => {
        logger.info(`Re-syncing configuration file ${args.configPath}`);
        _syncConfig();
    }, RESYNC_CONFIG_INTERVAL_MS);

    // Sync immediately on startup
    _syncConfig();

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

            logger.info(`Indexing ${repo.id}...`);

            if (existsSync(repo.path)) {
                await fetchRepository(repo);
            } else {
                const operationId = await createOperation({
                    type: 'clone',
                    progress: 0,
                    status: 'running',
                    repoId: repo.id,
                    startedAtDate: new Date().toUTCString(),
                }, db);

                try {
                    await cloneRepository(repo, (progress) => {
                        updateOperation(operationId, {
                            progress: progress,
                        }, db);
                    });
                } catch (err: any) {
                    console.error(err);
                    await updateOperation(operationId, {
                        status: 'failed',
                        message: err.message,
                    }, db);
                    throw err;
                }

                await updateOperation(operationId, {
                    status: 'completed',
                }, db);
            }

            await indexRepository(repo, context);
            
            await db.update(({ repos }) => repos[repo.id].lastIndexedDate = new Date().toUTCString());
            logger.info(`Indexed ${repo.id}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }
})();
