import { existsSync, FSWatcher, statSync, watch } from "fs";
import { createLogger } from "./logger.js";
import { LocalConfig } from "./schemas/v2.js";
import { AppContext, LocalRepository } from "./types.js";
import { resolvePathRelativeToConfig } from "./utils.js";
import path from "path";

const logger = createLogger('local');
const fileWatchers = new Map<string, FSWatcher>();
const abortControllers = new Map<string, AbortController>();


export const getLocalRepoFromConfig = (config: LocalConfig, ctx: AppContext) => {
    const repoPath = resolvePathRelativeToConfig(config.path, ctx.configPath);
    logger.debug(`Resolved path '${config.path}' to '${repoPath}'`);

    if (!existsSync(repoPath)) {
        throw new Error(`The local repository path '${repoPath}' referenced in ${ctx.configPath} does not exist`);
    }

    const stat = statSync(repoPath);
    if (!stat.isDirectory()) {
        throw new Error(`The local repository path '${repoPath}' referenced in ${ctx.configPath} is not a directory`);
    }

    const repo: LocalRepository = {
        vcs: 'local',
        name: path.basename(repoPath),
        id: repoPath,
        path: repoPath,
        isStale: false,
        excludedPaths: config.exclude?.paths ?? [],
        watch: config.watch ?? true,
    }

    return repo;
}

export const initLocalRepoFileWatchers = (repos: LocalRepository[], onUpdate: (repo: LocalRepository, ac: AbortSignal) => Promise<void>) => {
    // Close all existing watchers
    fileWatchers.forEach((watcher) => {
        watcher.close();
    });

    repos
        .filter(repo => !repo.isStale && repo.watch)
        .forEach((repo) => {
            logger.info(`Watching local repository ${repo.id} for changes...`);
            const watcher = watch(repo.path, async () => {
                const existingController = abortControllers.get(repo.id);
                if (existingController) {
                    existingController.abort();
                }

                const controller = new AbortController();
                abortControllers.set(repo.id, controller);

                try {
                    await onUpdate(repo, controller.signal);
                } catch (err: any) {
                    if (err.name !== 'AbortError') {
                        logger.error(`Error while watching local repository ${repo.id} for changes:`);
                        console.log(err);
                    } else {
                        logger.debug(`Aborting watch for local repository ${repo.id} due to abort signal`);
                    }
                }
            });
            fileWatchers.set(repo.id, watcher);
        });
}