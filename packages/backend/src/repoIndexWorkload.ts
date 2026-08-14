import { PrismaClient, Repo, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { createLogger, getRepoPath, JobLogSink, getRepoIdFromPath, RepoMetadata, repoMetadataSchema, REPO_INDEX_QUEUE } from "@sourcebot/shared";
import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import micromatch from 'micromatch';
import { INDEX_CACHE_DIR, REPOS_CACHE_DIR } from './constants.js';
import { cloneRepository, fetchRepository, getBranches, getCommitHashForRefName, getLatestCommitTimestamp, getLocalDefaultBranch, getTags, isPathAValidGitRepoRoot, isRepoEmpty, unsetGitConfig, upsertGitConfig, writeCommitGraph } from './git.js';
import { captureEvent } from './posthog.js';
import { RepoWithConnections, Settings, Workload } from "./types.js";
import { getAuthCredentialsForRepo, getRepoIdFromShardFileName, measure } from './utils.js';
import { cleanupTempShards, indexGitRepository } from './zoekt.js';

const LOG_TAG = 'repo-index-workload';
const logger = createLogger(LOG_TAG);
const REPO_INDEX_LOCK_DURATION_MS = 60_000;

interface Props {
    db: PrismaClient;
    settings: Settings;
}

export const createRepoIndexWorkload = ({
    db,
    settings,
}: Props): Workload<'repo-index'> => ({
    queueSpec: REPO_INDEX_QUEUE,
    concurrency: settings.maxRepoIndexingJobConcurrency,
    // This lock is shared with repoPermissionSyncWorkload so indexing, cleanup,
    // and permission syncing are serialized for the same repository.
    executionLock: {
        resource: ({ repoId }) => `sourcebot:lock:repo:${repoId}`,
        durationMs: REPO_INDEX_LOCK_DURATION_MS,
    },
    process: async ({ data, jobId, logger: jobLogger, signal }) => {
        signal.throwIfAborted();
        const start = await prepareRepoIndexJob({
            db,
            repoId: data.repoId,
            type: data.type,
            jobId,
        });

        if (start.action === "skip") {
            jobLogger.info(
                `Skipping ${data.type} job for repo ${data.repoId}: ${start.reason}`,
            );

            if (data.type === "CLEANUP" && start.repoMissing) {
                signal.throwIfAborted();
                await cleanupOrphanedRepoResourcesForRepoId(
                    data.repoId,
                    jobLogger,
                );
            }
            return;
        }

        signal.throwIfAborted();
        const { repo } = start;
        jobLogger.debug(`Running ${data.type} job for repo ${repo.name} (id: ${repo.id})`);

        if (data.type === "CLEANUP") {
            signal.throwIfAborted();
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
                jobLogger.info(
                    `Skipping CLEANUP job for repo ${repo.id}: repository is no longer eligible for cleanup`,
                );
                return;
            }

            signal.throwIfAborted();
            await cleanupRepository(repo, jobLogger);
        } else {
            const isFirstIndex = repo.indexedAt === null;
            const revisions = await indexRepository(db, settings, repo, jobLogger, signal);
            signal.throwIfAborted();
            const { path: repoPath } = getRepoPath(repo);
            const isEmpty = await isRepoEmpty({ path: repoPath });
            const commitHash = isEmpty ? undefined : await getCommitHashForRefName({
                path: repoPath,
                refName: 'HEAD',
            });
            const pushedAt = await getLatestCommitTimestamp({ path: repoPath });
            const defaultBranch = await getLocalDefaultBranch({ path: repoPath });
            const currentRepo = await db.repo.findUniqueOrThrow({
                where: { id: repo.id },
                select: { metadata: true },
            });

            signal.throwIfAborted();
            await db.repo.update({
                where: { id: repo.id },
                data: {
                    indexedAt: new Date(),
                    indexedCommitHash: commitHash,
                    pushedAt,
                    metadata: {
                        ...(currentRepo.metadata as RepoMetadata),
                        indexedRevisions: revisions,
                    } satisfies RepoMetadata,
                    defaultBranch,
                },
            });

            if (isFirstIndex) {
                captureEvent('backend_repo_first_indexed', {
                    repoId: repo.id,
                    type: repo.external_codeHostType,
                });
            }
        }
    },
    onCompleted: async ({ data: { repoId }, jobId }) => {
        await db.$transaction(async (tx) => {
            await tx.repoIndexingJob.updateMany({
                where: {
                    id: jobId,
                },
                data: {
                    status: RepoIndexingJobStatus.COMPLETED,
                    completedAt: new Date(),
                    errorMessage: null,
                },
            });
            await tx.repo.updateMany({
                where: {
                    id: repoId,
                    latestIndexingJobId: jobId,
                },
                data: {
                    latestIndexingJobStatus: RepoIndexingJobStatus.COMPLETED,
                },
            });
        });
    },
    onTerminalFailure: async ({ data: { repoId }, jobId }, error) => {
        await db.$transaction(async (tx) => {
            await tx.repoIndexingJob.updateMany({
                where: {
                    id: jobId,
                },
                data: {
                    status: RepoIndexingJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: error.message,
                },
            });
            await tx.repo.updateMany({
                where: {
                    id: repoId,
                    latestIndexingJobId: jobId,
                },
                data: {
                    latestIndexingJobStatus: RepoIndexingJobStatus.FAILED,
                },
            });
        });
    },
});

type RepoIndexStartDecision =
    | {
          action: "run";
          repo: RepoWithConnections;
      }
    | {
          action: "skip";
          reason: string;
          repoMissing: boolean;
      };

const prepareRepoIndexJob = async ({
    db,
    repoId,
    type,
    jobId,
}: {
    db: PrismaClient;
    repoId: number;
    type: "INDEX" | "CLEANUP";
    jobId: string;
}): Promise<RepoIndexStartDecision> =>
    db.$transaction(async (tx) => {
        const repo = await tx.repo.findUnique({
            where: { id: repoId },
            include: {
                connections: {
                    include: {
                        connection: true,
                    },
                },
            },
        });

        if (!repo) {
            return {
                action: "skip",
                reason: "repository no longer exists",
                repoMissing: true,
            };
        }

        if (type === "CLEANUP" && repo.isAutoCleanupDisabled) {
            return {
                action: "skip",
                reason: "automatic cleanup is disabled",
                repoMissing: false,
            };
        }

        if (type === "CLEANUP" && repo.connections.length > 0) {
            return {
                action: "skip",
                reason: "repository has been reattached to a connection",
                repoMissing: false,
            };
        }

        await tx.repoIndexingJob.upsert({
            where: {
                id: jobId,
            },
            update: {
                status: RepoIndexingJobStatus.IN_PROGRESS,
                completedAt: null,
                errorMessage: null,
            },
            create: {
                id: jobId,
                repoId,
                type: RepoIndexingJobType[type],
                status: RepoIndexingJobStatus.IN_PROGRESS,
            },
        });
        await tx.repo.update({
            where: {
                id: repoId,
            },
            data: {
                latestIndexingJobId: jobId,
                latestIndexingJobStatus: RepoIndexingJobStatus.IN_PROGRESS,
            },
        });

        return {
            action: "run",
            repo,
        };
    });

const indexRepository = async (
    db: PrismaClient,
    settings: Settings,
    repo: RepoWithConnections,
    logger: JobLogSink,
    signal: AbortSignal,
) => {
    const { path: repoPath, isReadOnly } = getRepoPath(repo);

    const metadata = repoMetadataSchema.parse(repo.metadata);

    const credentials = await getAuthCredentialsForRepo(repo, logger);
    const gitHttpCredentials = credentials?.gitHttpCredentials;

    // If the repo path exists but it is not a valid git repository root, this indicates
    // that the repository is in a bad state. To fix, we remove the directory and perform
    // a fresh clone.
    if (existsSync(repoPath) && !(await isPathAValidGitRepoRoot({ path: repoPath }))) {
        const isValidGitRepo = await isPathAValidGitRepoRoot({
            path: repoPath,
            signal,
        });

        if (!isValidGitRepo && !isReadOnly) {
            logger.warn(`${repoPath} is not a valid git repository root. Deleting directory and performing fresh clone.`);
            await rm(repoPath, { recursive: true, force: true });
        }
    }

    if (existsSync(repoPath) && !isReadOnly) {
        // @NOTE: in #483, we changed the cloning method s.t., we _no longer_
        // write the clone URL (which could contain a auth token) to the
        // `remote.origin.url` entry. For the upgrade scenario, we want
        // to unset this key since it is no longer needed, hence this line.
        // This will no-op if the key is already unset.
        // @see: https://github.com/sourcebot-dev/sourcebot/pull/483
        await unsetGitConfig({
            path: repoPath,
            keys: ["remote.origin.url"],
            signal,
        });

        logger.debug(`Fetching ${repo.name} (id: ${repo.id})...`);
        const { durationMs } = await measure(() => fetchRepository({
            cloneUrl: repo.cloneUrl,
            credentials: gitHttpCredentials,
            path: repoPath,
            onProgress: ({ method, stage, progress }) => {
                logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.name} (id: ${repo.id})`)
            },
            signal,
        }));
        const fetchDuration_s = durationMs / 1000;

        logger.debug(`Fetched ${repo.name} (id: ${repo.id}) in ${fetchDuration_s}s`);

        // Update the commit-graph after fetch. Force a full backfill the first time we
        // see this repo after the --changed-paths rollout, so historical commits get
        // Bloom filters. Subsequent fetches do a cheap incremental write.
        const needsBackfill = !metadata.commitGraphChangedPathsBackfilledAt;
        if (needsBackfill) {
            logger.debug(`Backfilling changed-path Bloom filters for ${repo.name} (id: ${repo.id})...`);
        }
        await writeCommitGraph({
            path: repoPath,
            forceBackfill: needsBackfill,
            signal,
        });
    } else if (!isReadOnly) {
        logger.debug(`Cloning ${repo.name} (id: ${repo.id})...`);

        const { durationMs } = await measure(() => cloneRepository({
            cloneUrl: repo.cloneUrl,
            credentials: gitHttpCredentials,
            path: repoPath,
            onProgress: ({ method, stage, progress }) => {
                logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.name} (id: ${repo.id})`)
            },
            signal
        }));
        const cloneDuration_s = durationMs / 1000;

        logger.debug(`Cloned ${repo.name} (id: ${repo.id}) in ${cloneDuration_s}s`);

        // Write the commit-graph for the freshly cloned repo.
        await writeCommitGraph({
            path: repoPath,
            signal,
        });
    }

    // Record that this repo's commit-graph now includes changed-path Bloom filters
    // for its full history (either freshly written during clone, or backfilled above
    // during fetch).
    if (!isReadOnly && !metadata.commitGraphChangedPathsBackfilledAt) {
        signal.throwIfAborted();
        await db.repo.update({
            where: { id: repo.id },
            data: {
                metadata: {
                    ...metadata,
                    commitGraphChangedPathsBackfilledAt: new Date().toISOString(),
                } satisfies RepoMetadata,
            },
        });
    }

    // Regardless of clone or fetch, always upsert the git config for the repo.
    // This ensures that the git config is always up to date for whatever we
    // have in the DB.
    if (metadata.gitConfig && !isReadOnly) {
        await upsertGitConfig({
            path: repoPath,
            gitConfig: metadata.gitConfig,
            signal,
        });
    }

    const defaultBranch = await getLocalDefaultBranch({
        path: repoPath,
    });

    // Ensure defaultBranch has refs/heads/ prefix for consistent searching
    const defaultBranchWithPrefix = defaultBranch && !defaultBranch.startsWith('refs/')
        ? `refs/heads/${defaultBranch}`
        : defaultBranch;

    let revisions = defaultBranchWithPrefix ? [defaultBranchWithPrefix] : ['HEAD'];

    if (metadata.branches) {
        const branchGlobs = metadata.branches
        const allBranches = await getBranches(repoPath);
        const matchingBranches =
            allBranches
                .filter((branch) => micromatch.isMatch(branch, branchGlobs))
                .map((branch) => `refs/heads/${branch}`);

        revisions = [
            ...revisions,
            ...matchingBranches
        ];
    }

    if (metadata.tags) {
        const tagGlobs = metadata.tags;
        const allTags = await getTags(repoPath);
        const matchingTags =
            allTags
                .filter((tag) => micromatch.isMatch(tag, tagGlobs))
                .map((tag) => `refs/tags/${tag}`);

        revisions = [
            ...revisions,
            ...matchingTags
        ];
    }

    // De-duplicate revisions to ensure we don't have duplicate branches/tags
    revisions = [...new Set(revisions)];

    // zoekt has a limit of 64 branches/tags to index.
    if (revisions.length > 64) {
        logger.warn(`Too many revisions (${revisions.length}) for repo ${repo.id}, truncating to 64`);
        captureEvent('backend_revisions_truncated', {
            repoId: repo.id,
            revisionCount: revisions.length,
        });
        revisions = revisions.slice(0, 64);
    }

    logger.debug(`Indexing ${repo.name} (id: ${repo.id})...`);
    try {
        signal.throwIfAborted();
        const { durationMs } = await measure(() => indexGitRepository(repo, settings, revisions, signal));
        signal.throwIfAborted();
        const indexDuration_s = durationMs / 1000;
        logger.debug(`Indexed ${repo.name} (id: ${repo.id}) in ${indexDuration_s}s`);
    } catch (error) {
        if (signal.aborted) {
            throw error;
        }

        // Clean up any temporary shard files left behind by the failed indexing operation.
        // Zoekt creates .tmp files during indexing which can accumulate if indexing fails repeatedly.
        logger.warn(`Indexing failed for ${repo.name} (id: ${repo.id}), cleaning up temp shard files...`);
        await cleanupTempShards(repo);
        throw error;
    }

    return revisions;
};

const cleanupRepository = async (repo: Repo, logger: JobLogSink) => {
    const { path: repoPath, isReadOnly } = getRepoPath(repo);
    if (existsSync(repoPath) && !isReadOnly) {
        logger.debug(`Deleting repo directory ${repoPath}`);
        await rm(repoPath, { recursive: true, force: true });
    }

    const files = (await readdir(INDEX_CACHE_DIR)).filter(file => getRepoIdFromShardFileName(file) === repo.id);
    for (const file of files) {
        const filePath = `${INDEX_CACHE_DIR}/${file}`;
        logger.debug(`Deleting shard file ${filePath}`);
        await rm(filePath, { force: true });
    }
};

const cleanupOrphanedRepoResourcesForRepoId = async (
    repoId: number,
    logger: JobLogSink,
) => {
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
            const existingIds = new Set(existingRepos.map(r => r.id));
            for (const [repoId, repoPath] of repoIdToPath) {
                if (!existingIds.has(repoId)) {
                    logger.debug(`Removing orphaned repo directory with no DB record: ${repoPath}`);
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
            const existingIds = new Set(existingRepos.map(r => r.id));
            for (const [repoId, shards] of repoIdToShards) {
                if (!existingIds.has(repoId)) {
                    for (const entry of shards) {
                        const shardPath = `${INDEX_CACHE_DIR}/${entry}`;
                        logger.debug(`Removing orphaned index shard with no DB record: ${shardPath}`);
                        await rm(shardPath, { force: true });
                    }
                }
            }
        }
    }
};
