import express, { Request, Response } from 'express';
import { Server } from 'http';
import client, { Registry, Counter, Gauge } from 'prom-client';
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('prometheus-client');

export class PromClient {
    private registry: Registry;
    private app: express.Application;
    private server: Server;

    public activeRepoIndexJobs: Gauge<string>;
    public pendingRepoIndexJobs: Gauge<string>;
    public repoIndexJobReattemptsTotal: Counter<string>;
    public repoIndexJobFailTotal: Counter<string>;
    public repoIndexJobSuccessTotal: Counter<string>;

    public readonly PORT = 3060;

    constructor() {
        this.registry = new Registry();

        this.activeRepoIndexJobs = new Gauge({
            name: 'active_repo_index_jobs',
            help: 'The number of repo jobs in progress',
            labelNames: ['repo', 'type'],
        });
        this.registry.registerMetric(this.activeRepoIndexJobs);

        this.pendingRepoIndexJobs = new Gauge({
            name: 'pending_repo_index_jobs',
            help: 'The number of repo jobs waiting in queue',
            labelNames: ['repo', 'type'],
        });
        this.registry.registerMetric(this.pendingRepoIndexJobs);

        this.repoIndexJobReattemptsTotal = new Counter({
            name: 'repo_index_job_reattempts',
            help: 'The number of repo job reattempts',
            labelNames: ['repo', 'type'],
        });
        this.registry.registerMetric(this.repoIndexJobReattemptsTotal);

        this.repoIndexJobFailTotal = new Counter({
            name: 'repo_index_job_fails',
            help: 'The number of repo job fails',
            labelNames: ['repo', 'type'],
        });
        this.registry.registerMetric(this.repoIndexJobFailTotal);

        this.repoIndexJobSuccessTotal = new Counter({
            name: 'repo_index_job_successes',
            help: 'The number of repo job successes',
            labelNames: ['repo', 'type'],
        });
        this.registry.registerMetric(this.repoIndexJobSuccessTotal);

        client.collectDefaultMetrics({
            register: this.registry,
        });

        this.app = express();
        this.app.get('/metrics', async (req: Request, res: Response) => {
            res.set('Content-Type', this.registry.contentType);

            const metrics = await this.registry.metrics();
            res.end(metrics);
        });

        this.server = this.app.listen(this.PORT, () => {
            logger.info(`Prometheus metrics server is running on port ${this.PORT}`);
        });
    }

    async dispose() {
        return new Promise<void>((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}