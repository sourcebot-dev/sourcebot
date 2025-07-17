import { Job, Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from "@sourcebot/logger";
import { Connection, PrismaClient, Repo, RepoToConnection, RepoIndexingStatus, StripeSubscriptionStatus } from "@sourcebot/db";
import { GithubConnectionConfig, GitlabConnectionConfig, GiteaConnectionConfig, BitbucketConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { AppContext, Settings, repoMetadataSchema } from "./types.js";
import { getRepoPath, getTokenFromConfig, measure, getShardPrefix } from "./utils.js";
import { cloneRepository, fetchRepository, upsertGitConfig } from "./git.js";
import { existsSync, readdirSync, promises } from 'fs';
import { indexGitRepository } from "./zoekt.js";
import { PromClient } from './promClient.js';
import * as Sentry from "@sentry/node";
import { env } from './env.js';

interface IRepoManager {
    validateIndexedReposHaveShards: () => Promise<void>;
    blockingPollLoop: () => void;
    dispose: () => void;
}

const REPO_INDEXING_QUEUE = 'repoIndexingQueue';
const REPO_GC_QUEUE = 'repoGarbageCollectionQueue';

type RepoWithConnections = Repo & { connections: (RepoToConnection & { connection: Connection })[] };
type RepoIndexingPayload = {
    repo: RepoWithConnections,
}

type RepoGarbageCollectionPayload = {
    repo: Repo,
}

const logger = createLogger('repo-manager');

export class RepoManager implements IRepoManager {
    private indexWorker: Worker;
    private indexQueue: Queue<RepoIndexingPayload>;
    private gcWorker: Worker;
    private gcQueue: Queue<RepoGarbageCollectionPayload>;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
        private promClient: PromClient,
        private ctx: AppContext,
    ) {
        // Repo indexing
        this.indexQueue = new Queue<RepoIndexingPayload>(REPO_INDEXING_QUEUE, {
            connection: redis,
        });
        this.indexWorker = new Worker(REPO_INDEXING_QUEUE, this.runIndexJob.bind(this), {
            connection: redis,
            concurrency: this.settings.maxRepoIndexingJobConcurrency,
        });
        this.indexWorker.on('completed', this.onIndexJobCompleted.bind(this));
        this.indexWorker.on('failed', this.onIndexJobFailed.bind(this));

        // Garbage collection
        this.gcQueue = new Queue<RepoGarbageCollectionPayload>(REPO_GC_QUEUE, {
            connection: redis,
        });
        this.gcWorker = new Worker(REPO_GC_QUEUE, this.runGarbageCollectionJob.bind(this), {
            connection: redis,
            concurrency: this.settings.maxRepoGarbageCollectionJobConcurrency,
        });
        this.gcWorker.on('completed', this.onGarbageCollectionJobCompleted.bind(this));
        this.gcWorker.on('failed', this.onGarbageCollectionJobFailed.bind(this));
    }

    public async blockingPollLoop() {
        while (true) {
            await this.fetchAndScheduleRepoIndexing();
            await this.fetchAndScheduleRepoGarbageCollection();
            await this.fetchAndScheduleRepoTimeouts();

            await new Promise(resolve => setTimeout(resolve, this.settings.reindexRepoPollingIntervalMs));
        }
    }

    ///////////////////////////
    // Repo indexing
    ///////////////////////////

    private async scheduleRepoIndexingBulk(repos: RepoWithConnections[]) {
        await this.db.$transaction(async (tx) => {
            await tx.repo.updateMany({
                where: { id: { in: repos.map(repo => repo.id) } },
                data: { repoIndexingStatus: RepoIndexingStatus.IN_INDEX_QUEUE }
            });

            const reposByOrg = repos.reduce<Record<number, RepoWithConnections[]>>((acc, repo) => {
                if (!acc[repo.orgId]) {
                    acc[repo.orgId] = [];
                }
                acc[repo.orgId].push(repo);
                return acc;
            }, {});

            for (const orgId in reposByOrg) {
                const orgRepos = reposByOrg[orgId];
                // Set priority based on number of repos (more repos = lower priority)
                // This helps prevent large orgs from overwhelming the indexQueue
                const priority = Math.min(Math.ceil(orgRepos.length / 10), 2097152);

                await this.indexQueue.addBulk(orgRepos.map(repo => ({
                    name: 'repoIndexJob',
                    data: { repo },
                    opts: {
                        priority: priority,
                        removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                        removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                    },
                })));

                // Increment pending jobs counter for each repo added
                orgRepos.forEach(repo => {
                    this.promClient.pendingRepoIndexingJobs.inc({ repo: repo.id.toString() });
                });

                logger.info(`Added ${orgRepos.length} jobs to indexQueue for org ${orgId} with priority ${priority}`);
            }


        }).catch((err: unknown) => {
            logger.error(`Failed to add jobs to indexQueue for repos ${repos.map(repo => repo.id).join(', ')}: ${err}`);
        });
    }


    private async fetchAndScheduleRepoIndexing() {
        const thresholdDate = new Date(Date.now() - this.settings.reindexIntervalMs);
        const repos = await this.db.repo.findMany({
            where: {
                OR: [
                    // "NEW" is really a misnomer here - it just means that the repo needs to be indexed
                    // immediately. In most cases, this will be because the repo was just created and
                    // is indeed "new". However, it could also be that a "retry" was requested on a failed
                    // index. So, we don't want to block on the indexedAt timestamp here.
                    {
                        repoIndexingStatus: RepoIndexingStatus.NEW,
                    },
                    // When the repo has already been indexed, we only want to reindex if the reindexing
                    // interval has elapsed (or if the date isn't set for some reason).
                    {
                        AND: [
                            { repoIndexingStatus: RepoIndexingStatus.INDEXED },
                            {
                                OR: [
                                    { indexedAt: null },
                                    { indexedAt: { lt: thresholdDate } },
                                ]
                            }
                        ]
                    }
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

        if (repos.length > 0) {
            await this.scheduleRepoIndexingBulk(repos);
        }
    }


    // TODO: do this better? ex: try using the tokens from all the connections 
    // We can no longer use repo.cloneUrl directly since it doesn't contain the token for security reasons. As a result, we need to
    // fetch the token here using the connections from the repo. Multiple connections could be referencing this repo, and each
    // may have their own token. This method will just pick the first connection that has a token (if one exists) and uses that. This
    // may technically cause syncing to fail if that connection's token just so happens to not have access to the repo it's referencing.
    private async getCloneCredentialsForRepo(repo: RepoWithConnections, db: PrismaClient): Promise<{ username?: string, password: string } | undefined> {

        for (const { connection } of repo.connections) {
            if (connection.connectionType === 'github') {
                const config = connection.config as unknown as GithubConnectionConfig;
                if (config.token) {
                    const token = await getTokenFromConfig(config.token, connection.orgId, db, logger);
                    return {
                        password: token,
                    }
                }
            }

            else if (connection.connectionType === 'gitlab') {
                const config = connection.config as unknown as GitlabConnectionConfig;
                if (config.token) {
                    const token = await getTokenFromConfig(config.token, connection.orgId, db, logger);
                    return {
                        username: 'oauth2',
                        password: token,
                    }
                }
            }

            else if (connection.connectionType === 'gitea') {
                const config = connection.config as unknown as GiteaConnectionConfig;
                if (config.token) {
                    const token = await getTokenFromConfig(config.token, connection.orgId, db, logger);
                    return {
                        password: token,
                    }
                }
            }

            else if (connection.connectionType === 'bitbucket') {
                const config = connection.config as unknown as BitbucketConnectionConfig;
                if (config.token) {
                    const token = await getTokenFromConfig(config.token, connection.orgId, db, logger);
                    const username = config.user ?? 'x-token-auth';
                    return {
                        username,
                        password: token,
                    }
                }
            }
        }

        return undefined;
    }

    private async syncGitRepository(repo: RepoWithConnections, repoAlreadyInIndexingState: boolean) {
        const { path: repoPath, isReadOnly } = getRepoPath(repo, this.ctx);

        const metadata = repoMetadataSchema.parse(repo.metadata);

        // If the repo was already in the indexing state, this job was likely killed and picked up again. As a result,
        // to ensure the repo state is valid, we delete the repo if it exists so we get a fresh clone 
        if (repoAlreadyInIndexingState && existsSync(repoPath) && !isReadOnly) {
            logger.info(`Deleting repo directory ${repoPath} during sync because it was already in the indexing state`);
            await promises.rm(repoPath, { recursive: true, force: true });
        }

        if (existsSync(repoPath) && !isReadOnly) {
            logger.info(`Fetching ${repo.displayName}...`);

            const { durationMs } = await measure(() => fetchRepository(repoPath, ({ method, stage, progress }) => {
                logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.displayName}`)
            }));
            const fetchDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Fetched ${repo.displayName} in ${fetchDuration_s}s`);

        } else if (!isReadOnly) {
            logger.info(`Cloning ${repo.displayName}...`);

            const auth = await this.getCloneCredentialsForRepo(repo, this.db);
            const cloneUrl = new URL(repo.cloneUrl);
            if (auth) {
                // @note: URL has a weird behavior where if you set the password but
                // _not_ the username, the ":" delimiter will still be present in the
                // URL (e.g., https://:password@example.com). To get around this, if
                // we only have a password, we set the username to the password.
                // @see: https://www.typescriptlang.org/play/?#code/MYewdgzgLgBArgJwDYwLwzAUwO4wKoBKAMgBQBEAFlFAA4QBcA9I5gB4CGAtjUpgHShOZADQBKANwAoREj412ECNhAIAJmhhl5i5WrJTQkELz5IQAcxIy+UEAGUoCAJZhLo0UA
                if (!auth.username) {
                    cloneUrl.username = auth.password;
                } else {
                    cloneUrl.username = auth.username;
                    cloneUrl.password = auth.password;
                }
            }

            const { durationMs } = await measure(() => cloneRepository(cloneUrl.toString(), repoPath, ({ method, stage, progress }) => {
                logger.debug(`git.${method} ${stage} stage ${progress}% complete for ${repo.displayName}`)
            }));
            const cloneDuration_s = durationMs / 1000;

            process.stdout.write('\n');
            logger.info(`Cloned ${repo.displayName} in ${cloneDuration_s}s`);
        }

        // Regardless of clone or fetch, always upsert the git config for the repo.
        // This ensures that the git config is always up to date for whatever we
        // have in the DB.
        if (metadata.gitConfig && !isReadOnly) {
            await upsertGitConfig(repoPath, metadata.gitConfig);
        }

        logger.info(`Indexing ${repo.displayName}...`);
        const { durationMs } = await measure(() => indexGitRepository(repo, this.settings, this.ctx));
        const indexDuration_s = durationMs / 1000;
        logger.info(`Indexed ${repo.displayName} in ${indexDuration_s}s`);
    }

    private async runIndexJob(job: Job<RepoIndexingPayload>) {
        logger.info(`Running index job (id: ${job.id}) for repo ${job.data.repo.displayName}`);
        const repo = job.data.repo as RepoWithConnections;

        // We have to use the existing repo object to get the repoIndexingStatus because the repo object
        // inside the job is unchanged from when it was added to the queue.
        const existingRepo = await this.db.repo.findUnique({
            where: {
                id: repo.id,
            },
        });
        if (!existingRepo) {
            logger.error(`Repo ${repo.id} not found`);
            const e = new Error(`Repo ${repo.id} not found`);
            Sentry.captureException(e);
            throw e;
        }
        const repoAlreadyInIndexingState = existingRepo.repoIndexingStatus === RepoIndexingStatus.INDEXING;


        await this.db.repo.update({
            where: {
                id: repo.id,
            },
            data: {
                repoIndexingStatus: RepoIndexingStatus.INDEXING,
            }
        });
        this.promClient.activeRepoIndexingJobs.inc();
        this.promClient.pendingRepoIndexingJobs.dec({ repo: repo.id.toString() });

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                await this.syncGitRepository(repo, repoAlreadyInIndexingState);
                break;
            } catch (error) {
                Sentry.captureException(error);

                attempts++;
                this.promClient.repoIndexingReattemptsTotal.inc();
                if (attempts === maxAttempts) {
                    logger.error(`Failed to sync repository ${repo.name} (id: ${repo.id}) after ${maxAttempts} attempts. Error: ${error}`);
                    throw error;
                }

                const sleepDuration = (env.REPO_SYNC_RETRY_BASE_SLEEP_SECONDS * 1000) * Math.pow(2, attempts - 1);
                logger.error(`Failed to sync repository ${repo.name} (id: ${repo.id}), attempt ${attempts}/${maxAttempts}. Sleeping for ${sleepDuration / 1000}s... Error: ${error}`);
                await new Promise(resolve => setTimeout(resolve, sleepDuration));
            }
        }
    }

    private async onIndexJobCompleted(job: Job<RepoIndexingPayload>) {
        logger.info(`Repo index job for repo ${job.data.repo.displayName} (id: ${job.data.repo.id}, jobId: ${job.id}) completed`);
        this.promClient.activeRepoIndexingJobs.dec();
        this.promClient.repoIndexingSuccessTotal.inc();

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

    private async onIndexJobFailed(job: Job<RepoIndexingPayload> | undefined, err: unknown) {
        logger.info(`Repo index job for repo ${job?.data.repo.displayName} (id: ${job?.data.repo.id}, jobId: ${job?.id}) failed with error: ${err}`);
        Sentry.captureException(err, {
            tags: {
                repoId: job?.data.repo.id,
                jobId: job?.id,
                queue: REPO_INDEXING_QUEUE,
            }
        });

        if (job) {
            this.promClient.activeRepoIndexingJobs.dec();
            this.promClient.repoIndexingFailTotal.inc();

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

    ///////////////////////////
    // Repo garbage collection
    ///////////////////////////

    private async scheduleRepoGarbageCollectionBulk(repos: Repo[]) {
        await this.db.$transaction(async (tx) => {
            await tx.repo.updateMany({
                where: { id: { in: repos.map(repo => repo.id) } },
                data: { repoIndexingStatus: RepoIndexingStatus.IN_GC_QUEUE }
            });

            await this.gcQueue.addBulk(repos.map(repo => ({
                name: 'repoGarbageCollectionJob',
                data: { repo },
                opts: {
                    removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                    removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                }
            })));

            logger.info(`Added ${repos.length} jobs to gcQueue`);
        });
    }

    private async fetchAndScheduleRepoGarbageCollection() {
        ////////////////////////////////////
        // Get repos with no connections
        ////////////////////////////////////


        const thresholdDate = new Date(Date.now() - this.settings.repoGarbageCollectionGracePeriodMs);
        const reposWithNoConnections = await this.db.repo.findMany({
            where: {
                repoIndexingStatus: {
                    in: [
                        RepoIndexingStatus.INDEXED, // we don't include NEW repos here because they'll be picked up by the index queue (potential race condition)
                        RepoIndexingStatus.FAILED,
                    ]
                },
                connections: {
                    none: {}
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: thresholdDate } }
                ]
            },
        });
        if (reposWithNoConnections.length > 0) {
            logger.info(`Garbage collecting ${reposWithNoConnections.length} repos with no connections: ${reposWithNoConnections.map(repo => repo.id).join(', ')}`);
        }

        ////////////////////////////////////
        // Get inactive org repos
        ////////////////////////////////////
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const inactiveOrgRepos = await this.db.repo.findMany({
            where: {
                org: {
                    stripeSubscriptionStatus: StripeSubscriptionStatus.INACTIVE,
                    stripeLastUpdatedAt: {
                        lt: sevenDaysAgo
                    }
                },
                OR: [
                    { indexedAt: null },
                    { indexedAt: { lt: thresholdDate } }
                ]
            }
        });

        if (inactiveOrgRepos.length > 0) {
            logger.info(`Garbage collecting ${inactiveOrgRepos.length} inactive org repos: ${inactiveOrgRepos.map(repo => repo.id).join(', ')}`);
        }

        const reposToDelete = [...reposWithNoConnections, ...inactiveOrgRepos];
        if (reposToDelete.length > 0) {
            await this.scheduleRepoGarbageCollectionBulk(reposToDelete);
        }
    }

    private async runGarbageCollectionJob(job: Job<RepoGarbageCollectionPayload>) {
        logger.info(`Running garbage collection job (id: ${job.id}) for repo ${job.data.repo.displayName} (id: ${job.data.repo.id})`);
        this.promClient.activeRepoGarbageCollectionJobs.inc();

        const repo = job.data.repo as Repo;
        await this.db.repo.update({
            where: {
                id: repo.id
            },
            data: {
                repoIndexingStatus: RepoIndexingStatus.GARBAGE_COLLECTING
            }
        });

        // delete cloned repo
        const { path: repoPath, isReadOnly } = getRepoPath(repo, this.ctx);
        if (existsSync(repoPath) && !isReadOnly) {
            logger.info(`Deleting repo directory ${repoPath}`);
            await promises.rm(repoPath, { recursive: true, force: true });
        }

        // delete shards
        const shardPrefix = getShardPrefix(repo.orgId, repo.id);
        const files = readdirSync(this.ctx.indexPath).filter(file => file.startsWith(shardPrefix));
        for (const file of files) {
            const filePath = `${this.ctx.indexPath}/${file}`;
            logger.info(`Deleting shard file ${filePath}`);
            await promises.rm(filePath, { force: true });
        }
    }

    private async onGarbageCollectionJobCompleted(job: Job<RepoGarbageCollectionPayload>) {
        logger.info(`Garbage collection job ${job.id} completed`);
        this.promClient.activeRepoGarbageCollectionJobs.dec();
        this.promClient.repoGarbageCollectionSuccessTotal.inc();

        await this.db.repo.delete({
            where: {
                id: job.data.repo.id
            }
        });
    }

    private async onGarbageCollectionJobFailed(job: Job<RepoGarbageCollectionPayload> | undefined, err: unknown) {
        logger.info(`Garbage collection job failed (id: ${job?.id ?? 'unknown'}) with error: ${err}`);
        Sentry.captureException(err, {
            tags: {
                repoId: job?.data.repo.id,
                jobId: job?.id,
                queue: REPO_GC_QUEUE,
            }
        });

        if (job) {
            this.promClient.activeRepoGarbageCollectionJobs.dec();
            this.promClient.repoGarbageCollectionFailTotal.inc();

            await this.db.repo.update({
                where: {
                    id: job.data.repo.id
                },
                data: {
                    repoIndexingStatus: RepoIndexingStatus.GARBAGE_COLLECTION_FAILED
                }
            });
        }
    }

    ///////////////////////////
    // Repo index validation
    ///////////////////////////

    public async validateIndexedReposHaveShards() {
        logger.info('Validating indexed repos have shards...');
        
        const indexedRepos = await this.db.repo.findMany({
            where: {
                repoIndexingStatus: RepoIndexingStatus.INDEXED
            }
        });
        logger.info(`Found ${indexedRepos.length} repos in the DB marked as INDEXED`);

        if (indexedRepos.length === 0) {
            return;
        }

        const reposToReindex: number[] = [];

        for (const repo of indexedRepos) {
            const shardPrefix = getShardPrefix(repo.orgId, repo.id);
            
            // TODO: this doesn't take into account if a repo has multiple shards and only some of them are missing. To support that, this logic
            // would need to know how many total shards are expected for this repo
            let hasShards = false;
            try {
                const files = readdirSync(this.ctx.indexPath);
                hasShards = files.some(file => file.startsWith(shardPrefix));
            } catch (error) {
                logger.error(`Failed to read index directory ${this.ctx.indexPath}: ${error}`);
                continue;
            }

            if (!hasShards) {
                logger.info(`Repo ${repo.displayName} (id: ${repo.id}) is marked as INDEXED but has no shards on disk. Marking for reindexing.`);
                reposToReindex.push(repo.id);
            }
        }

        if (reposToReindex.length > 0) {
            await this.db.repo.updateMany({
                where: {
                    id: { in: reposToReindex }
                },
                data: {
                    repoIndexingStatus: RepoIndexingStatus.NEW
                }
            });
            logger.info(`Marked ${reposToReindex.length} repos for reindexing due to missing shards`);
        }

        logger.info('Done validating indexed repos have shards');
    }

    private async fetchAndScheduleRepoTimeouts() {
        const repos = await this.db.repo.findMany({
            where: {
                repoIndexingStatus: RepoIndexingStatus.INDEXING,
                updatedAt: {
                    lt: new Date(Date.now() - this.settings.repoIndexTimeoutMs)
                }
            }
        });

        if (repos.length > 0) {
            logger.info(`Scheduling ${repos.length} repo timeouts`);
            await this.scheduleRepoTimeoutsBulk(repos);
        }
    }

    private async scheduleRepoTimeoutsBulk(repos: Repo[]) {
        await this.db.$transaction(async (tx) => {
            await tx.repo.updateMany({
                where: { id: { in: repos.map(repo => repo.id) } },
                data: { repoIndexingStatus: RepoIndexingStatus.FAILED }
            });
        });
    }

    public async dispose() {
        this.indexWorker.close();
        this.indexQueue.close();
        this.gcQueue.close();
        this.gcWorker.close();
    }
}