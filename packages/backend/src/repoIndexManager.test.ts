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
    unsetGitConfig: vi.fn(),
    upsertGitConfig: vi.fn(),
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
    Queue: vi.fn().mockImplementation(() => ({
        add: mockQueueAdd,
        close: mockQueueClose,
    })),
    Worker: vi.fn().mockImplementation((_name: string, processor: unknown) => ({
        on: mockWorkerOn,
        close: mockWorkerClose,
        processJob: processor,
    })),
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
    default: vi.fn().mockImplementation(() => ({
        using: mockRedlockUsing,
    })),
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
import { cloneRepository, fetchRepository, isPathAValidGitRepoRoot } from './git.js';
import { RepoIndexManager } from './repoIndexManager.js';
import { indexGitRepository } from './zoekt.js';

// Helper to create mock Prisma client
const createMockPrisma = () => {
    return {
        repo: {
            findMany: vi.fn().mockResolvedValue([]),
            update: vi.fn(),
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

        test('updates repo.indexedAt and indexedCommitHash on completion', async () => {
            const repo = createMockRepoWithConnections();
            (existsSync as Mock).mockReturnValue(true);

            manager = new RepoIndexManager(mockPrisma, mockSettings, mockRedis, mockPromClient as any);

            (mockPrisma.repoIndexingJob.findUniqueOrThrow as Mock).mockResolvedValue({
                status: RepoIndexingJobStatus.PENDING,
            });
            // The onJobCompleted handler calls repoIndexingJob.update once and then repo.update
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repoId: repo.id,
                repo,
                metadata: {},
            });
            (mockPrisma.repo.update as Mock).mockResolvedValue(repo);

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

            expect(mockPrisma.repoIndexingJob.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'job-1' },
                    data: expect.objectContaining({
                        status: RepoIndexingJobStatus.COMPLETED,
                        completedAt: expect.any(Date),
                    }),
                })
            );

            expect(mockPrisma.repo.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: repo.id },
                    data: expect.objectContaining({
                        indexedAt: expect.any(Date),
                        indexedCommitHash: 'abc123',
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
                status: RepoIndexingJobStatus.PENDING,
            });
            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.CLEANUP,
                repoId: repo.id,
                repo,
                metadata: {},
            });
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

            (mockPrisma.repoIndexingJob.update as Mock).mockResolvedValue({
                type: RepoIndexingJobType.INDEX,
                repoId: repo.id,
                repo,
                metadata: {},
            });
            (mockPrisma.repo.update as Mock).mockResolvedValue(repo);

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
                            update: {
                                latestIndexingJobStatus: RepoIndexingJobStatus.COMPLETED,
                            },
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
