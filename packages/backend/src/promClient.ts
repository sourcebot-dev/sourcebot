import express, { Request, Response } from 'express';
import client, { Registry, Counter, Gauge, Histogram } from 'prom-client';

export class PromClient {
    private registry: Registry;
    private app: express.Application;
    public activeRepoIndexingJobs: Gauge<string>;
    public repoIndexingDuration: Histogram<string>;
    public repoIndexingErrors: Counter<string>;
    public repoIndexingFails: Counter<string>;
    public repoIndexingSuccesses: Counter<string>;
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

        this.repoIndexingErrors = new Counter({
            name: 'repo_indexing_errors',
            help: 'The number of repo indexing errors',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingErrors);

        this.repoIndexingFails = new Counter({
            name: 'repo_indexing_fails',
            help: 'The number of repo indexing fails',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingFails);

        this.repoIndexingSuccesses = new Counter({
            name: 'repo_indexing_successes',
            help: 'The number of repo indexing successes',
            labelNames: ['repo'],
        });
        this.registry.registerMetric(this.repoIndexingSuccesses);

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