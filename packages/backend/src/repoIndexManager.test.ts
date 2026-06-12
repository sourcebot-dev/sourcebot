import type { PrismaClient, Repo } from '@sourcebot/db';
import { RepoIndexingJobStatus, RepoIndexingJobType } from '@sourcebot/db';
import type { Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { afterEach, beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import type { RepoWithConnections, Settings } from './types.js';

// Mock modules before importing the class under test
vi.mock('@sentry/node', () => ({
    captureException: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
    env: {
        DATA_CACHE_DIR: 'test-data',
        REDIS_REMOVE_ON_COMPLETE: true,
        REDIS_REMOVE_ON_FAIL: true,
    },
    getRepoPath: vi.fn((repo: Repo) => ({
        path: `/test-data/repos/${repo.id}`,
        isReadOnly: false,
    })),
    repoMetadataSchema: {
        parse: vi.fn((metadata: unknown) => metadata ?? {}),
    },
    repoIndexingJobMetadataSchema: {
        parse: vi.fn((metadata: unknown) => metadata ?? {}),
    },
}));

vi.mock('./constants.js', () => ({
    WORKER_STOP_GRACEFUL_TIMEOUT_MS: 5000,
    INDEX_CACHE_DIR: 'test-data/index',
    REPOS_CACHE_DIR: 'test-data/repos',
}));

vi.mock('./git.js', () => ({
    cloneRepository: vi.fn(),
    fetchRepository: vi.fn(),
    getBranches: vi.fn().mockResolvedValue([]),
    getTags: vi.fn().mockResolvedValue([]),
    getLocalDefaultBranch: vi.fn().mockResolvedValue('main'),
    getCommitHashForRefName: vi.fn().mockResolvedValue('abc123'),
    getLatestCommitTimestamp: vi.fn().mockResolvedValue(new Date()),
    isPathAValidGitRepoRoot: vi.fn().mockResolvedValue(true),
    isRepoEmpty: vi.fn().mockResolvedValue(false),
    unsetGitConfig: vi.fn(),
    upsertGitConfig: vi.fn(),
    writeCommitGraph: vi.fn(),
}));

vi.mock('./zoekt.js', () => ({
    indexGitRepository: vi.fn().mockResolvedValue({ stdout: '', stderr: '' }),
}));

vi.mock('./posthog.js', () => ({
    captureEvent: vi.fn(),
}));

vi.mock('./utils.js', () => ({
    getAuthCredentialsForRepo: vi.fn().mockResolvedValue(null),
    getShardPrefix: vi.fn((orgId: number, repoId: number) => `${orgId}_${repoId}`),
    getRepoIdFromShardFileName: vi.fn((fileName: string) => {
        const match = fileName.match(/^(\d+)_(\d+)_/);
        if (!match) {
            return undefined;
        }
        return parseInt(match[2], 10);
    }),
    measure: vi.fn(async (cb: () => Promise<unknown>) => {
        const data = await cb();
        return { data, durationMs: 100 };
    }),
    setIntervalAsync: vi.fn((cb: () => void, _interval: number) => {
        // Return a mock interval ID
        return { unref: vi.fn() } as unknown as NodeJS.Timeout;
    }),
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('fs/promises', () => ({
    rm: vi.fn(),
    readdir: vi.fn().mockResolvedValue([]),
}));

// Mock BullMQ
const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
const mockQueueClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
const mockWorkerOn = vi.fn();

vi.mock('bullmq', () => ({
    Queue: vi.fn().mockImplementation(function () {
        return {
            add: mockQueueAdd,
            close: mockQueueClose,
        };
    }),
    Worker: vi.fn().mockImplementation(function (_name: string, processor: unknown) {
        return {
            on: mockWorkerOn,
            close: mockWorkerClose,
            processJob: processor,
        };
    }),
    DelayedError: class DelayedError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'DelayedError';
        }
    },
}));

// Mock Redlock
const mockRedlockUsing = vi.fn();
vi.mock('redlock', () => ({
    default: vi.fn().mockImplementation(function () {
        return {
            using: mockRedlockUsing,
        };
    }),
    ExecutionError: class ExecutionError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'ExecutionError';
        }
    },
}));

// Import after mocks are set up
import { existsSync } from 'fs';
import { readdir, rm } from 'fs/promises';
import { ExecutionError } from 'redlock';
import {
    cloneRepository,
    fetchRepository,
    getBranches,
    getTags,
    isPathAValidGitRepoRoot,
} from './git.js';
import { RepoIndexManager } from './repoIndexManager.js';
import { indexGitRepository } from './zoekt.js';

// Helper to create mock Prisma client
const createMockPrisma = () => {
    return {
        repo: {
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
            updateMany: vi.fn(),
            delete: vi.fn(),
        },
        repoIndexingJob: {
            createManyAndReturn: vi.fn().mockResolvedValue([]),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ status: RepoIndexingJobStatus.PENDING }),
            update: vi.fn(),
        },
    } as unknown as PrismaClient;
};

// Helper to create mock Redis
const createMockRedis = () => {
    return {} as Redis;
};

// Helper to create mock Settings
const createMockSettings = (): Settings => ({
    maxFileSize: 2 * 1024 * 1024,
    maxTrigramCount: 20000,
    reindexIntervalMs: 1000 * 60 * 60,
    resyncConnectionIntervalMs: 1000 * 60 * 60 * 24,
    resyncConnectionPollingIntervalMs: 1000 * 1,
    reindexRepoPollingIntervalMs: 1000 * 1,
    maxConnectionSyncJobConcurrency: 8,
    maxRepoIndexingJobConcurrency: 8,
    maxRepoGarbageCollectionJobConcurrency: 8,
    repoGarbageCollectionGracePeriodMs: 10 * 1000,
    repoIndexTimeoutMs: 1000 * 60 * 60 * 2,
    enablePublicAccess: false,
    experiment_repoDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24,
    experiment_userDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24,
    repoDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24,
    userDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24,
    maxAccountPermissionSyncJobConcurrency: 8,
    maxRepoPermissionSyncJobConcurrency: 8,
});

// Helper to create mock PromClient
const createMockPromClient = () => ({
    pendingRepoIndexJobs: { inc: vi.fn(), dec: vi.fn() },
    activeRepoIndexJobs: { inc: vi.fn(), dec: vi.fn() },
    repoIndexJobSuccessTotal: { inc: vi.fn() },
    repoIndexJobFailTotal: { inc: vi.fn() },
});

// Helper to create a mock repo
const createMockRepo = (overrides: Partial<Repo> = {}): Repo => ({
    id: 1,
    name: 'test-repo',
    cloneUrl: 'https://github.com/test/repo.git',
    orgId: 1,
    indexedAt: null,
    indexedCommitHash: null,
    defaultBranch: 'main',
    metadata: {},
    repoIndexingStatus: 'CREATED',
    latestIndexingJobStatus: null,
    latestConnectionSyncJobStatus: null,
    external_id: 'test-external-id',
    external_codeHostType: 'github',
    external_codeHostUrl: 'https://github.com',
    pushedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    isFork: false,
    isArchived: false,
    isAutoCleanupDisabled: false,
    ...overrides,
} as Repo);

// Helper to create a mock repoWithConnections
const createMockRepoWithConnections = (overrides: Partial<RepoWithConnections> = {}): RepoWithConnections => ({
    ...createMockRepo(),
    connections: [],
    ...overrides,
});

describe('RepoIndexManager', () => {
    let mockPrisma: PrismaClient;
    let mockRedis: Redis;
    let mockSettings: Settings;
    let mockPromClient: ReturnType<typeof createMockPromClient>;
    let manager: RepoIndexManager;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma = createMockPrisma();
        mockRedis = createMockRedis();
        mockSettings = createMockSettings();
        mockPromClient = createMockPromClient();

        // Default redlock behavior - execute the callback immediately
        mockRedlockUsing.mockImplementation(async (_keys: string[], _ttl: number, cb: (signal: AbortSignal) => Promise<void>) => {
            const signal = new AbortController().signal;
            return cb(signal);
        });
    });

    afterEach(async () => {
        if (manager) {
            await manager.dispose();
        }
    });

    describe('Job Processing - Success', () => {
        test('clones new repository when directory does not exist', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(false);
            (cloneRepository as Mock).mockResolvedValue(undefined);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            // Set up mocks for job processing
            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            // Simulate processing a job
            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            // Get the worker processor callback
            const { Worker } = await import('bullmq');
            const workerCalls = (Worker as unknown as Mock).mock.calls;
            expect(workerCalls.length).toBeGreaterThan(0);
            const processor = workerCalls[0][1];

            // Execute the processor
            await processor(mockJob);

            expect(cloneRepository).toHaveBeenCalledWith(
                expect.objectContaining({
                    cloneUrl: repo.cloneUrl,
                    path: expect.stringContaining(`${repo.id}`),
                })
            );
        });

        test('deletes directory and performs fresh clone when path exists but is not a valid git repo root', async () => {
            const repo = createMockRepoWithConnections();
            // Path exists initially but after rm is called, it no longer exists
            // First two calls return true (first check + check before delete), then false (after deletion)
            (existsSync as Mock)
                .mockReturnValueOnce(true)   // First existsSync check - path exists
                .mockReturnValueOnce(false); // Second existsSync check - path deleted, trigger clone
            (isPathAValidGitRepoRoot as Mock).mockResolvedValue(false);
            (cloneRepository as Mock).mockResolvedValue(undefined);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            // Should delete the invalid directory
            expect(rm).toHaveBeenCalledWith(
                expect.stringContaining(`${repo.id}`),
                { recursive: true, force: true }
            );

            // Should perform a fresh clone after deletion
            expect(cloneRepository).toHaveBeenCalledWith(
                expect.objectContaining({
                    cloneUrl: repo.cloneUrl,
                    path: expect.stringContaining(`${repo.id}`),
                })
            );
        });

        test('fetches existing repository when directory exists', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(true);
            (fetchRepository as Mock).mockResolvedValue(undefined);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            expect(fetchRepository).toHaveBeenCalledWith(
                expect.objectContaining({
                    cloneUrl: repo.cloneUrl,
                    path: expect.stringContaining(`${repo.id}`),
                })
            );
        });

        test('invokes zoekt-git-index with correct arguments', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(true);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            expect(indexGitRepository).toHaveBeenCalledWith(
                repo,
                mockSettings,
                expect.arrayContaining(['refs/heads/main']),
                expect.any(Object)
            );
        });

        test('keeps default branch and truncates to the first 63 matching tags', async () => {
            const newestTagsFirst = Array.from(
                { length: 70 },
                (_, index) => `v${70 - index}.0.0`,
            );
            const repo = createMockRepoWithConnections({
                metadata: {
                    tags: ['**'],
                },
            });
            (existsSync as Mock).mockReturnValue(true);
            (getTags as Mock).mockResolvedValue(newestTagsFirst);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            expect(indexGitRepository).toHaveBeenCalledWith(
                repo,
                mockSettings,
                [
                    'refs/heads/main',
                    ...newestTagsFirst
                        .slice(0, 63)
                        .map((tag) => `refs/tags/${tag}`),
                ],
                expect.any(Object)
            );
        });

        test('de-duplicates the default branch before truncating matching branches', async () => {
            const newestBranchesFirst = [
                'feature/newest',
                'main',
                ...Array.from(
                    { length: 68 },
                    (_, index) => `feature/${68 - index}`,
                ),
            ];
            const repo = createMockRepoWithConnections({
                metadata: {
                    branches: ['main', 'feature/**'],
                },
            });
            (existsSync as Mock).mockReturnValue(true);
            (getBranches as Mock).mockResolvedValue(newestBranchesFirst);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            const revisions = (indexGitRepository as Mock).mock.calls.at(-1)?.[2] as string[];

            expect(revisions).toHaveLength(64);
            expect(revisions.filter((revision) => revision === 'refs/heads/main')).toHaveLength(1);
            expect(revisions[0]).toBe('refs/heads/main');
            expect(revisions).toContain('refs/heads/feature/newest');
            expect(revisions).not.toContain('refs/heads/feature/6');
        });

        test('updates repo.indexedAt and indexedCommitHash on completion', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(true);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            // The onJobCompleted handler reads the job via findUniqueOrThrow, then marks it
            // COMPLETED and updates the repo (indexedAt, etc.) in a single repoIndexingJob.update
            // with a nested repo update.
            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repoId: repo.id,
                repo,
                metadata: {},
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({ repo });

            // Get the onCompleted handler
            const onCompletedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'completed')?.[1];
            expect(onCompletedHandler).toBeDefined();

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
            } as unknown as Job;

            await onCompletedHandler(mockJob);

            // The job status and indexedAt must be written together (single transaction) to
            // close the race where the scheduler sees a completed job but a stale indexedAt.
            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.COMPLETED,
                        completedAt: expect.any(Date),
                        repo: {
                            update: expect.objectContaining({
                                indexedAt: expect.any(Date),
                                indexedCommitHash: 'abc123',
                            }),
                        },
                    }),
                })
            );
        });
    });

    describe('Job Processing - Failure', () => {
        test('marks job as FAILED when git clone throws', async () => {
            const repo = createMockRepoWithConnections();
            const cloneError = new Error('Clone failed: authentication error');
            (existsSync as Mock).mockReturnValue(false);
            (cloneRepository as Mock).mockRejectedValue(cloneError);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock)
                .mockResolvedValueOnce({ type: RepoIndexingJobType.INDEX, repo })
                .mockResolvedValueOnce({ repo });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
                getState: vi.fn().mockResolvedValue('failed'),
            } as unknown as Job;

            // Get the onFailed handler
            const onFailedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'failed')?.[1];
            expect(onFailedHandler).toBeDefined();

            await onFailedHandler(mockJob, cloneError);

            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.FAILED,
                        errorMessage: cloneError.message,
                    }),
                })
            );

            expect(mockPromClient.repoIndexJobFailTotal.inc).toHaveBeenCalledWith({
                repo: repo.name,
                type: 'index',
            });
        });

        test('marks job as FAILED when zoekt-git-index fails', async () => {
            const repo = createMockRepoWithConnections();
            const indexError = new Error('zoekt-git-index: failed to index');
            (existsSync as Mock).mockReturnValue(true);
            (indexGitRepository as Mock).mockRejectedValue(indexError);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock)
                .mockResolvedValueOnce({ type: RepoIndexingJobType.INDEX, repo })
                .mockResolvedValueOnce({ repo });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
                getState: vi.fn().mockResolvedValue('failed'),
            } as unknown as Job;

            const onFailedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'failed')?.[1];
            await onFailedHandler(mockJob, indexError);

            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.FAILED,
                        errorMessage: indexError.message,
                    }),
                })
            );
        });
    });

    describe('Concurrency Control', () => {
        test('prevents concurrent jobs for the same repo via redlock', async () => {
            const repo = createMockRepoWithConnections();

            // Simulate lock acquisition failure
            mockRedlockUsing.mockRejectedValue(new ExecutionError('Lock already held'));

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn().mockResolvedValue(undefined),
                token: 'test-token',
            } as unknown as Job;

            const { Worker, DelayedError } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];

            // The processor should throw a DelayedError when lock cannot be acquired
            await expect(processor(mockJob)).rejects.toThrow('locked');

            // Verify moveToDelayed was called to retry later
            expect(mockJob.moveToDelayed).toHaveBeenCalled();
        });
    });

    describe('Cleanup Jobs', () => {
        test('deletes repo directory and index shards', async () => {
            const repo = createMockRepoWithConnections({ id: 5, orgId: 2 });
            (existsSync as Mock).mockReturnValue(true);
            (readdir as Mock).mockResolvedValue(['2_5_v1.zoekt', '2_5_v2.zoekt', 'other_file.zoekt']);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.CLEANUP,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'cleanup-job-1',
                    type: 'CLEANUP',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            // Should delete the repo directory
            expect(rm).toHaveBeenCalledWith(
                expect.stringContaining(`${repo.id}`),
                { recursive: true, force: true }
            );

            // Should delete shard files matching the prefix
            expect(rm).toHaveBeenCalledWith(
                expect.stringContaining('2_5_v1.zoekt'),
                { force: true }
            );
            expect(rm).toHaveBeenCalledWith(
                expect.stringContaining('2_5_v2.zoekt'),
                { force: true }
            );
        });

        test('removes repo from database after cleanup', async () => {
            const repo = createMockRepoWithConnections({ id: 3 });
            (existsSync as Mock).mockReturnValue(false);
            (readdir as Mock).mockResolvedValue([]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                type: RepoIndexingJobType.CLEANUP,
                repoId: repo.id,
                repo,
                metadata: {},
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({ repo });
            (mockPrisma.repo.delete as Mock).mockResolvedValue(repo);

            const onCompletedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'completed')?.[1];

            const mockJob = {
                data: {
                    jobId: 'cleanup-job-1',
                    type: 'CLEANUP',
                    repoId: repo.id,
                    repoName: repo.name,
                },
            } as unknown as Job;

            await onCompletedHandler(mockJob);

            expect(mockPrisma.repo.delete).toHaveBeenCalledWith({
                where: { id: repo.id },
            });

            expect(mockPromClient.repoIndexJobSuccessTotal.inc).toHaveBeenCalledWith({
                repo: repo.name,
                type: 'cleanup',
            });
        });
    });

    describe('Missing Shard Reconciliation', () => {
        const indexedRepo = (id: number, name: string) => createMockRepo({
            id,
            name,
            indexedAt: new Date(),
            indexedCommitHash: 'abc123',
        });

        test('clears indexedAt for indexed repos whose shard files are missing on startup', async () => {
            (existsSync as Mock).mockImplementation((path: string) => path === 'test-data/index');
            // Repo 1 has a shard on disk; repo 2 does not.
            (readdir as Mock).mockResolvedValue(['1_1_v16.00000.zoekt']);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([
                indexedRepo(1, 'repo-with-shard'),
                indexedRepo(2, 'repo-missing-shard'),
            ]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            expect(mockPrisma.repo.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [2] } },
                data: { indexedAt: null },
            });
        });

        test('does not touch repos when all shards are present', async () => {
            (existsSync as Mock).mockImplementation((path: string) => path === 'test-data/index');
            (readdir as Mock).mockResolvedValue(['1_1_v16.00000.zoekt', '1_2_v16.00000.zoekt']);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([
                indexedRepo(1, 'repo-1'),
                indexedRepo(2, 'repo-2'),
            ]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            expect(mockPrisma.repo.updateMany).not.toHaveBeenCalled();
        });

        test('marks all indexed repos as stale when the index directory is missing', async () => {
            (existsSync as Mock).mockReturnValue(false);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([
                indexedRepo(1, 'repo-1'),
                indexedRepo(2, 'repo-2'),
            ]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            expect(mockPrisma.repo.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [1, 2] } },
                data: { indexedAt: null },
            });
        });

        test('does not count temporary shard files as valid shards', async () => {
            (existsSync as Mock).mockImplementation((path: string) => path === 'test-data/index');
            (readdir as Mock).mockResolvedValue(['1_2_v16.00000.zoekt123.tmp']);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([
                indexedRepo(2, 'repo-with-only-tmp-shard'),
            ]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            expect(mockPrisma.repo.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [2] } },
                data: { indexedAt: null },
            });
        });

        test('only considers repos that are indexed, non-empty, and connected', async () => {
            (existsSync as Mock).mockImplementation((path: string) => path === 'test-data/index');
            (readdir as Mock).mockResolvedValue([]);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            // The reconciliation query must exclude unindexed repos (nothing to mark),
            // empty repos (indexing completes without producing a shard), and
            // unconnected repos (clearing indexedAt would bypass the GC grace period).
            expect(mockPrisma.repo.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        indexedAt: { not: null },
                        indexedCommitHash: { not: null },
                        connections: { some: {} },
                    }),
                })
            );

            expect(mockPrisma.repo.updateMany).not.toHaveBeenCalled();
        });

        test('reconciles on every scheduler poll, not just startup', async () => {
            (existsSync as Mock).mockImplementation((path: string) => path === 'test-data/index');
            (readdir as Mock).mockResolvedValue(['1_1_v16.00000.zoekt']);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([]);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);
            await manager.startScheduler();

            // Simulate the index directory being wiped while the worker is running,
            // with repo 1 still marked as indexed in the DB.
            (readdir as Mock).mockResolvedValue([]);
            (mockPrisma.repo.findMany as Mock).mockResolvedValue([
                indexedRepo(1, 'repo-1'),
            ]);

            const { setIntervalAsync } = await import('./utils.js');
            const tick = (setIntervalAsync as Mock).mock.calls[0][0];
            await tick();

            expect(mockPrisma.repo.updateMany).toHaveBeenCalledWith({
                where: { id: { in: [1] } },
                data: { indexedAt: null },
            });
        });
    });

    describe('latestIndexingJobStatus Updates', () => {
        test('sets latestIndexingJobStatus to IN_PROGRESS when job starts', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(true);
            // Ensure indexGitRepository resolves for this test
            (indexGitRepository as Mock).mockResolvedValue({ stdout: '', stderr: '' });

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repo,
            });

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                moveToDelayed: vi.fn(),
            } as unknown as Job;

            const { Worker } = await import('bullmq');
            const processor = (Worker as unknown as Mock).mock.calls[0][1];
            await processor(mockJob);

            // Verify the first update call sets latestIndexingJobStatus to IN_PROGRESS
            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.IN_PROGRESS,
                        repo: {
                            update: {
                                latestIndexingJobStatus: RepoIndexingJobStatus.IN_PROGRESS,
                            },
                        },
                    }),
                })
            );
        });

        test('sets latestIndexingJobStatus to COMPLETED when job succeeds', async () => {
            const repo = createMockRepoWithConnections();

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repoId: repo.id,
                repo,
                metadata: {},
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({ repo });

            const onCompletedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'completed')?.[1];

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
            } as unknown as Job;

            await onCompletedHandler(mockJob);

            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.COMPLETED,
                        repo: {
                            update: expect.objectContaining({
                                latestIndexingJobStatus: RepoIndexingJobStatus.COMPLETED,
                            }),
                        },
                    }),
                })
            );
        });

        test('sets latestIndexingJobStatus to FAILED when job fails', async () => {
            const repo = createMockRepoWithConnections();
            const error = new Error('Job processing failed');

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({ repo });

            const onFailedHandler = mockWorkerOn.mock.calls.find((call: unknown[]) => call[0] === 'failed')?.[1];

            const mockJob = {
                data: {
                    jobId: 'job-1',
                    type: 'INDEX',
                    repoId: repo.id,
                    repoName: repo.name,
                },
                getState: vi.fn().mockResolvedValue('failed'),
            } as unknown as Job;

            await onFailedHandler(mockJob, error);

            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.FAILED,
                        errorMessage: error.message,
                        repo: {
                            update: {
                                latestIndexingJobStatus: RepoIndexingJobStatus.FAILED,
                            },
                        },
                    }),
                })
            );
        });
    });
});
