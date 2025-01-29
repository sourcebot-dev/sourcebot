import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from "./logger.js";
import { Connection, PrismaClient, Repo, RepoToConnection, RepoIndexingStatus } from "@sourcebot/db";
import { ConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { AppContext, Settings } from "./types.js";
import { captureEvent } from "./posthog.js";
import { getRepoPath, getTokenFromConfig, measure, getShardPrefix } from "./utils.js";
import { cloneRepository, fetchRepository } from "./git.js";
import { existsSync, rmSync, readdirSync } from 'fs';
import { indexGitRepository } from "./zoekt.js";
import os from 'os';

interface IRepoManager {
    blockingPollLoop: () => void;
    scheduleRepoIndexing: (repo: RepoWithConnections) => Promise<void>;
    dispose: () => void;
}

const QUEUE_NAME = 'repoIndexingQueue';

type RepoWithConnections = Repo & { connections: (RepoToConnection & { connection: Connection})[] };
type JobPayload = {
    repo: RepoWithConnections,
}

export class RepoManager implements IRepoManager {
    private queue = new Queue<JobPayload>(QUEUE_NAME);
    private worker: Worker;
    private logger = createLogger('RepoManager');

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
        private ctx: AppContext,
    ) {
        const numCores = os.cpus().length;
        this.worker = new Worker(QUEUE_NAME, this.runIndexJob.bind(this), {
            connection: redis,
            concurrency: numCores * this.settings.indexConcurrencyMultiple,
        });
        this.worker.on('completed', this.onIndexJobCompleted.bind(this));
        this.worker.on('failed', this.onIndexJobFailed.bind(this));
    }

    public async blockingPollLoop() {
        while(true) {
            this.fetchAndScheduleRepoIndexing();
            this.garbageCollectRepo();

            await new Promise(resolve => setTimeout(resolve, this.settings.reindexRepoPollingInternvalMs));
        }
    }

    public async scheduleRepoIndexing(repo: RepoWithConnections) {
        await this.db.$transaction(async (tx) => {
            await tx.repo.update({
                where: { id: repo.id },
                data: { repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE },
            });

            await this.queue.add('repoIndexJob', {
                repo
            });
            this.logger.info(`Added job to queue for repo ${repo.id}`);
        }).catch((err: unknown) => {
            this.logger.error(`Failed to add job to queue for repo ${repo.id}: ${err}`);
        });
    }

    private async fetchAndScheduleRepoIndexing() {
        const thresholdDate = new Date(Date.now() - this.settings.reindexIntervalMs);
        const repos = await this.db.repo.findMany({
            where: {
                repoIndexingStatus: {
                    notIn: [RepoIndexingStatus.IN_INDEX_QUEUE, RepoIndexingStatus.FAILED]
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: thresholdDate } },
                    { repoIndexingStatus: RepoIndexingStatus.NEW }
                ]
            },
            include: {
                connections: {
                    include: {
                        connection: true
                    }
                }
            }
        });

        for (const repo of repos) {
            await this.scheduleRepoIndexing(repo);
        } 
    }

    private async garbageCollectRepo() {
        const reposWithNoConnections = await this.db.repo.findMany({
            where: {
                repoIndexingStatus: { notIn: [RepoIndexingStatus.IN_INDEX_QUEUE, RepoIndexingStatus.INDEXING] }, // we let the job finish for now so we don't need to worry about cancelling
                connections: {
                    none: {}
                }
            }
        });

        for (const repo of reposWithNoConnections) {
            this.logger.info(`Garbage collecting repo with no connections: ${repo.id}`);

            // delete cloned repo
            const repoPath = getRepoPath(repo, this.ctx);
            if(existsSync(repoPath)) {
                this.logger.info(`Deleting repo directory ${repoPath}`);
                rmSync(repoPath, { recursive: true, force: true });
            }

            // delete shards
            const shardPrefix = getShardPrefix(repo.orgId, repo.id);
            const files = readdirSync(this.ctx.indexPath).filter(file => file.startsWith(shardPrefix));
            for (const file of files) {
                const filePath = `${this.ctx.indexPath}/${file}`;
                this.logger.info(`Deleting shard file ${filePath}`);
                rmSync(filePath);
            }
        }

        await this.db.repo.deleteMany({
            where: {
                id: {
                    in: reposWithNoConnections.map(repo => repo.id)
                }
            }
        });
    }

    // TODO: do this better? ex: try using the tokens from all the connections 
    // We can no longer use repo.cloneUrl directly since it doesn't contain the token for security reasons. As a result, we need to
    // fetch the token here using the connections from the repo. Multiple connections could be referencing this repo, and each
    // may have their own token. This method will just pick the first connection that has a token (if one exists) and uses that. This
    // may technically cause syncing to fail if that connection's token just so happens to not have access to the repo it's referrencing.
    private async getTokenForRepo(repo: RepoWithConnections, db: PrismaClient) {
        const repoConnections = repo.connections;
        if (repoConnections.length === 0) {
            this.logger.error(`Repo ${repo.id} has no connections`);
            return;
        }

        let token: string | undefined;
        for (const repoConnection of repoConnections) {
            const connection = repoConnection.connection;
            const config = connection.config as unknown as ConnectionConfig;
            if (config.token) {
                token = await getTokenFromConfig(config.token, connection.orgId, db);
                if (token) {
                    break;
                }
            }
        }

        return token;
    }

    private async syncGitRepository(repo: RepoWithConnections) {
        let fetchDuration_s: number | undefined = undefined;
        let cloneDuration_s: number | undefined = undefined;
    
        const repoPath = getRepoPath(repo, this.ctx);
        const metadata = repo.metadata as Record<string, string>;
    
        if (existsSync(repoPath)) {
            this.logger.info(`Fetching ${repo.id}...`);
    
            const { durationMs } = await measure(() => fetchRepository(repoPath, ({ method, stage, progress }) => {
                this.logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
            }));
            fetchDuration_s = durationMs / 1000;
    
            process.stdout.write('\n');
            this.logger.info(`Fetched ${repo.name} in ${fetchDuration_s}s`);
    
        } else {
            this.logger.info(`Cloning ${repo.id}...`);
    
            const token = await this.getTokenForRepo(repo, this.db);
            let cloneUrl = repo.cloneUrl;
            if (token) {
                const url = new URL(cloneUrl);
                url.username = token;
                cloneUrl = url.toString();
            }
    
            const { durationMs } = await measure(() => cloneRepository(cloneUrl, repoPath, metadata, ({ method, stage, progress }) => {
                this.logger.info(`git.${method} ${stage} stage ${progress}% complete for ${repo.id}`)
            }));
            cloneDuration_s = durationMs / 1000;
    
            process.stdout.write('\n');
            this.logger.info(`Cloned ${repo.id} in ${cloneDuration_s}s`);
        }
    
        this.logger.info(`Indexing ${repo.id}...`);
        const { durationMs } = await measure(() => indexGitRepository(repo, this.ctx));
        const indexDuration_s = durationMs / 1000;
        this.logger.info(`Indexed ${repo.id} in ${indexDuration_s}s`);
    
        return {
            fetchDuration_s,
            cloneDuration_s,
            indexDuration_s,
        }
    }

    private async runIndexJob(job: Job<JobPayload>) {
        const repo = job.data.repo as RepoWithConnections;
        await this.db.repo.update({
            where: {
                id: repo.id,
            },
            data: {
                repoIndexingStatus: RepoIndexingStatus.INDEXING,
            }
        });

        let indexDuration_s: number | undefined;
        let fetchDuration_s: number | undefined;
        let cloneDuration_s: number | undefined;

        const stats = await this.syncGitRepository(repo);
        indexDuration_s = stats.indexDuration_s;
        fetchDuration_s = stats.fetchDuration_s;
        cloneDuration_s = stats.cloneDuration_s;

        captureEvent('repo_synced', {
            vcs: 'git',
            codeHost: repo.external_codeHostType,
            indexDuration_s,
            fetchDuration_s,
            cloneDuration_s,
        });
    }
    
    private async onIndexJobCompleted(job: Job<JobPayload>) {
        this.logger.info(`Repo index job ${job.id} completed`);
    
        await this.db.repo.update({
            where: {
                id: job.data.repo.id,
            },
            data: {
                indexedAt: new Date(),
                repoIndexingStatus: RepoIndexingStatus.INDEXED,
            }
        });
    }

    private async onIndexJobFailed(job: Job<JobPayload> | undefined, err: unknown) {
        this.logger.info(`Repo index job failed with error: ${err}`);
        if (job) {
            await this.db.repo.update({
                where: {
                    id: job.data.repo.id,
                },
                data: {
                    repoIndexingStatus: RepoIndexingStatus.FAILED,
                }
            })
        }
    }

    public async dispose() {
        this.worker.close();
        this.queue.close();
    }
}