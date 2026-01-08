import client, { Registry, Counter, Gauge } from 'prom-client';
export class PromClient {
    public registry: Registry;

    public activeRepoIndexJobs: Gauge<string>;
    public pendingRepoIndexJobs: Gauge<string>;
    public repoIndexJobReattemptsTotal: Counter<string>;
    public repoIndexJobFailTotal: Counter<string>;
    public repoIndexJobSuccessTotal: Counter<string>;

    public activeConnectionSyncJobs: Gauge<string>;
    public pendingConnectionSyncJobs: Gauge<string>;
    public connectionSyncJobReattemptsTotal: Counter<string>;
    public connectionSyncJobFailTotal: Counter<string>;
    public connectionSyncJobSuccessTotal: Counter<string>;

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

        this.activeConnectionSyncJobs = new Gauge({
            name: 'active_connection_sync_jobs',
            help: 'The number of connection sync jobs in progress',
            labelNames: ['connection'],
        });
        this.registry.registerMetric(this.activeConnectionSyncJobs);

        this.pendingConnectionSyncJobs = new Gauge({
            name: 'pending_connection_sync_jobs',
            help: 'The number of connection sync jobs waiting in queue',
            labelNames: ['connection'],
        });
        this.registry.registerMetric(this.pendingConnectionSyncJobs);

        this.connectionSyncJobReattemptsTotal = new Counter({
            name: 'connection_sync_job_reattempts',
            help: 'The number of connection sync job reattempts',
            labelNames: ['connection'],
        });
        this.registry.registerMetric(this.connectionSyncJobReattemptsTotal);

        this.connectionSyncJobFailTotal = new Counter({
            name: 'connection_sync_job_fails',
            help: 'The number of connection sync job fails',
            labelNames: ['connection'],
        });
        this.registry.registerMetric(this.connectionSyncJobFailTotal);

        this.connectionSyncJobSuccessTotal = new Counter({
            name: 'connection_sync_job_successes',
            help: 'The number of connection sync job successes',
            labelNames: ['connection'],
        });
        this.registry.registerMetric(this.connectionSyncJobSuccessTotal);

        client.collectDefaultMetrics({
            register: this.registry,
        });
    }
}