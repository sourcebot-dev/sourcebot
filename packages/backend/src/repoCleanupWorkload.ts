import type { PrismaClient, Repo } from "@sourcebot/db";
import {
    createLogger,
    getRepoIdFromPath,
    getRepoPath,
    REPO_CLEANUP_QUEUE,
} from "@sourcebot/shared";
import { existsSync } from "fs";
import { readdir, rm } from "fs/promises";
import { INDEX_CACHE_DIR, REPOS_CACHE_DIR } from "./constants.js";
import { REPOSITORY_EXECUTION_LOCK } from "./repoLock.js";
import type { Settings, Workload } from "./types.js";
import { getRepoIdFromShardFileName } from "./utils.js";

const logger = createLogger("repo-cleanup-workload");

interface Props {
    db: PrismaClient;
    settings: Settings;
}

export const createRepoCleanupWorkload = ({
    db,
    settings,
}: Props): Workload<"repo-cleanup"> => ({
    queueSpec: REPO_CLEANUP_QUEUE,
    concurrency: settings.maxRepoIndexingJobConcurrency,
    // Cleanup and indexing use separate queues, but must never operate on the
    // same repository path or search index concurrently.
    executionLock: REPOSITORY_EXECUTION_LOCK,
    process: async ({ data: { repoId }, signal }) => {
        signal.throwIfAborted();
        const start = await prepareRepoCleanupJob({ db, repoId });

        if (start.action === "skip") {
            logger.debug(
                `Skipping CLEANUP job for repo ${repoId}: ${start.reason}`,
            );

            if (start.repoMissing) {
                signal.throwIfAborted();
                await cleanupOrphanedRepoResourcesForRepoId(repoId);
            }
            return;
        }

        signal.throwIfAborted();
        const { repo } = start;
        logger.debug(`Running CLEANUP job for repo ${repo.name} (id: ${repo.id})`);

        const { count } = await db.repo.deleteMany({
            where: {
                id: repo.id,
                isAutoCleanupDisabled: false,
                connections: {
                    none: {},
                },
            },
        });

        if (count === 0) {
            logger.debug(
                `Skipping CLEANUP job for repo ${repo.id}: repository is no longer eligible for cleanup`,
            );
            return;
        }

        signal.throwIfAborted();
        await cleanupRepository(repo);
    },
});

type RepoCleanupStartDecision =
    | {
          action: "run";
          repo: Repo;
      }
    | {
          action: "skip";
          reason: string;
          repoMissing: boolean;
      };

const prepareRepoCleanupJob = async ({
    db,
    repoId,
}: {
    db: PrismaClient;
    repoId: number;
}): Promise<RepoCleanupStartDecision> => {
    const repo = await db.repo.findUnique({
        where: { id: repoId },
        include: {
            connections: true,
        },
    });

    if (!repo) {
        return {
            action: "skip",
            reason: "repository no longer exists",
            repoMissing: true,
        };
    }

    if (repo.isAutoCleanupDisabled) {
        return {
            action: "skip",
            reason: "automatic cleanup is disabled",
            repoMissing: false,
        };
    }

    if (repo.connections.length > 0) {
        return {
            action: "skip",
            reason: "repository has been reattached to a connection",
            repoMissing: false,
        };
    }

    return {
        action: "run",
        repo,
    };
};

const cleanupRepository = async (repo: Repo) => {
    const { path: repoPath, isReadOnly } = getRepoPath(repo);
    if (existsSync(repoPath) && !isReadOnly) {
        logger.debug(`Deleting repo directory ${repoPath}`);
        await rm(repoPath, { recursive: true, force: true });
    }

    const files = (await readdir(INDEX_CACHE_DIR)).filter(
        (file) => getRepoIdFromShardFileName(file) === repo.id,
    );
    for (const file of files) {
        const filePath = `${INDEX_CACHE_DIR}/${file}`;
        logger.debug(`Deleting shard file ${filePath}`);
        await rm(filePath, { force: true });
    }
};

const cleanupOrphanedRepoResourcesForRepoId = async (repoId: number) => {
    const repoPath = `${REPOS_CACHE_DIR}/${repoId}`;
    if (existsSync(repoPath)) {
        logger.debug(`Deleting orphaned repo directory ${repoPath}`);
        await rm(repoPath, { recursive: true, force: true });
    }

    if (!existsSync(INDEX_CACHE_DIR)) {
        return;
    }

    const shardFiles = (await readdir(INDEX_CACHE_DIR)).filter(
        (file) => getRepoIdFromShardFileName(file) === repoId,
    );
    for (const file of shardFiles) {
        const filePath = `${INDEX_CACHE_DIR}/${file}`;
        logger.debug(`Deleting orphaned shard file ${filePath}`);
        await rm(filePath, { force: true });
    }
};

// Scans the repos and index directories on disk and removes any entries
// that have no corresponding Repo record in the database. This handles
// edge cases where the DB and disk resources are out of sync.
export const cleanupOrphanedRepoResources = async (db: PrismaClient) => {
    // --- Repo directories ---
    // Dirs are named by repoId: DATA_CACHE_DIR/repos/<repoId>/
    if (existsSync(REPOS_CACHE_DIR)) {
        const entries = await readdir(REPOS_CACHE_DIR);
        const repoIdToPath = new Map<number, string>();
        for (const entry of entries) {
            const repoPath = `${REPOS_CACHE_DIR}/${entry}`;
            const repoId = getRepoIdFromPath(repoPath);
            if (repoId !== undefined) {
                repoIdToPath.set(repoId, repoPath);
            }
        }

        if (repoIdToPath.size > 0) {
            const existingRepos = await db.repo.findMany({
                where: { id: { in: [...repoIdToPath.keys()] } },
                select: { id: true },
            });
            const existingIds = new Set(existingRepos.map((repo) => repo.id));
            for (const [repoId, repoPath] of repoIdToPath) {
                if (!existingIds.has(repoId)) {
                    logger.debug(
                        `Removing orphaned repo directory with no DB record: ${repoPath}`,
                    );
                    await rm(repoPath, { recursive: true, force: true });
                }
            }
        }
    }

    // --- Index shards ---
    // Shard files are prefixed with <orgId>_<repoId>: DATA_CACHE_DIR/index/<orgId>_<repoId>_*.zoekt
    if (existsSync(INDEX_CACHE_DIR)) {
        const entries = await readdir(INDEX_CACHE_DIR);
        const repoIdToShards = new Map<number, string[]>();
        for (const entry of entries) {
            const repoId = getRepoIdFromShardFileName(entry);
            if (repoId !== undefined) {
                const shards = repoIdToShards.get(repoId) ?? [];
                shards.push(entry);
                repoIdToShards.set(repoId, shards);
            }
        }

        if (repoIdToShards.size > 0) {
            const existingRepos = await db.repo.findMany({
                where: { id: { in: [...repoIdToShards.keys()] } },
                select: { id: true },
            });
            const existingIds = new Set(existingRepos.map((repo) => repo.id));
            for (const [repoId, shards] of repoIdToShards) {
                if (!existingIds.has(repoId)) {
                    for (const entry of shards) {
                        const shardPath = `${INDEX_CACHE_DIR}/${entry}`;
                        logger.debug(
                            `Removing orphaned index shard with no DB record: ${shardPath}`,
                        );
                        await rm(shardPath, { force: true });
                    }
                }
            }
        }
    }
};
