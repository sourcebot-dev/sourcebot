import express, { Request, Response } from 'express';
import client, { Registry, Counter, Gauge, Histogram } from 'prom-client';

export class PromClient {
    private registry: Registry;
    private app: express.Application;
    public activeRepoIndexingJobs: Gauge<string>;
    public repoIndexingDuration: Histogram<string>;
    public repoIndexingErrorTotal: Counter<string>;
    public repoIndexingFailTotal: Counter<string>;
    public repoIndexingSuccessTotal: Counter<string>;

    public activeRepoGarbageCollectionJobs: Gauge<string>;
    public repoGarbageCollectionDuration: Histogram<string>;
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

        this.repoIndexingDuration = new Histogram({
            name: 'repo_indexing_duration',
            help: 'The duration of repo indexing jobs', 
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingDuration);

        this.repoIndexingErrorTotal = new Counter({
            name: 'repo_indexing_errors',
            help: 'The number of repo indexing errors',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingErrorTotal);

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

        this.repoGarbageCollectionDuration = new Histogram({
            name: 'repo_garbage_collection_duration',
            help: 'The duration of repo garbage collection jobs',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoGarbageCollectionDuration);

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
            console.log(`Prometheus metrics server is running on port ${this.PORT}`);
        });
    }

    getRegistry(): Registry {
        return this.registry;
    }
}