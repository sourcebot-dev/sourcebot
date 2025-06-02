import express, { Request, Response } from 'express';
import client, { Registry, Counter, Gauge } from 'prom-client';
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('prometheus-client');

export class PromClient {
    private registry: Registry;
    private app: express.Application;
    public activeRepoIndexingJobs: Gauge<string>;
    public pendingRepoIndexingJobs: Gauge<string>;
    public repoIndexingReattemptsTotal: Counter<string>;
    public repoIndexingFailTotal: Counter<string>;
    public repoIndexingSuccessTotal: Counter<string>;

    public activeRepoGarbageCollectionJobs: Gauge<string>;
    public repoGarbageCollectionErrorTotal: Counter<string>;
    public repoGarbageCollectionFailTotal: Counter<string>;
    public repoGarbageCollectionSuccessTotal: Counter<string>;

    public readonly PORT = 3060;

    constructor() {
        this.registry = new Registry();

        this.activeRepoIndexingJobs = new Gauge({
            name: 'active_repo_indexing_jobs',
            help: 'The number of repo indexing jobs in progress',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.activeRepoIndexingJobs);

        this.pendingRepoIndexingJobs = new Gauge({
            name: 'pending_repo_indexing_jobs',
            help: 'The number of repo indexing jobs waiting in queue',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.pendingRepoIndexingJobs);

        this.repoIndexingReattemptsTotal = new Counter({
            name: 'repo_indexing_reattempts',
            help: 'The number of repo indexing reattempts',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingReattemptsTotal);

        this.repoIndexingFailTotal = new Counter({
            name: 'repo_indexing_fails',
            help: 'The number of repo indexing fails',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingFailTotal);

        this.repoIndexingSuccessTotal = new Counter({
            name: 'repo_indexing_successes',
            help: 'The number of repo indexing successes',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingSuccessTotal);

        this.activeRepoGarbageCollectionJobs = new Gauge({
            name: 'active_repo_garbage_collection_jobs',
            help: 'The number of repo garbage collection jobs in progress',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.activeRepoGarbageCollectionJobs);

        this.repoGarbageCollectionErrorTotal = new Counter({
            name: 'repo_garbage_collection_errors',
            help: 'The number of repo garbage collection errors',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoGarbageCollectionErrorTotal);

        this.repoGarbageCollectionFailTotal = new Counter({
            name: 'repo_garbage_collection_fails',
            help: 'The number of repo garbage collection fails',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoGarbageCollectionFailTotal);  

        this.repoGarbageCollectionSuccessTotal = new Counter({
            name: 'repo_garbage_collection_successes',
            help: 'The number of repo garbage collection successes',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoGarbageCollectionSuccessTotal);

        client.collectDefaultMetrics({
            register: this.registry,
        });

        this.app = express();
        this.app.get('/metrics', async (req: Request, res: Response) => {
            res.set('Content-Type', this.registry.contentType);

            const metrics = await this.registry.metrics();
            res.end(metrics);
        });

        this.app.listen(this.PORT, () => {
            logger.info(`Prometheus metrics server is running on port ${this.PORT}`);
        });
    }

    getRegistry(): Registry {
        return this.registry;
    }
}