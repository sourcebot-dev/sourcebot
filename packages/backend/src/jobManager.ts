import * as Sentry from "@sentry/node";
import { createLogger } from "@sourcebot/shared";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { JobProducer } from "./jobProducer.js";
import { CronWorkload, JobDetail, JobManager, QueueCounts, Schedule, Workload } from "./types.js";

const LOG_TAG = 'job-manager';
const logger = createLogger(LOG_TAG);

const CRON_QUEUE_NAME = 'cron';
const CRON_KEEP_COMPLETED = 50;
const CRON_KEEP_FAILED = 200;

const DURATION_UNITS_MS: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
};

export const parseDuration = (value: string): number => {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
    if (!match) {
        throw new Error(`Invalid duration "${value}". Expected e.g. "500ms", "30s", "5m", "6h", "1d".`);
    }
    return Number(match[1]) * DURATION_UNITS_MS[match[2]];
};

export const normalizeJobState = (state: string): JobDetail['state'] => {
    switch (state) {
        case 'waiting':
        case 'active':
        case 'delayed':
        case 'completed':
        case 'failed':
        case 'paused':
            return state;
        case 'prioritized':
        case 'waiting-children':
            return 'waiting';
        default:
            return 'unknown';
    }
};

const scheduleToRepeat = (schedule: Schedule) =>
    'pattern' in schedule ? { pattern: schedule.pattern } : { every: parseDuration(schedule.every) };

export function reconcile<TData>(opts: {
    name: string;
    schedule: Schedule;
    target: string;
    scan: () => Promise<TData[]>;
}): CronWorkload {
    return {
        name: opts.name,
        schedule: opts.schedule,
        handler: async ({ trigger }) => {
            const items = await opts.scan();
            for (const item of items) {
                await trigger(opts.target, item);
            }
        },
    };
}

export class BullMQJobManager implements JobManager {
    private readonly workloads = new Map<string, Workload<unknown, unknown>>();
    private readonly cronWorkloads = new Map<string, CronWorkload>();
    private readonly workers = new Map<string, Worker>();
    private readonly producer: JobProducer;
    private cronQueue?: Queue;
    private cronWorker?: Worker;
    private readonly abortController = new AbortController();

    constructor(private readonly connection: Redis) {
        this.producer = new JobProducer(connection);
    }

    register<T>(workload: Workload<T>): void {
        const name = workload.spec.name;
        if (this.workloads.has(name)) {
            throw new Error(`Workload "${name}" is already registered`);
        }
        this.workloads.set(name, workload as unknown as Workload<unknown, unknown>);
    }

    registerCron(cron: CronWorkload): void {
        if (this.cronWorkloads.has(cron.name)) {
            throw new Error(`Cron workload "${cron.name}" is already registered`);
        }
        this.cronWorkloads.set(cron.name, cron);
    }

    async start(): Promise<void> {
        if (this.workloads.size === 0 && this.cronWorkloads.size === 0) {
            logger.debug('start() called with nothing registered; nothing to do');
            return;
        }

        for (const workload of this.workloads.values()) {
            this.startWorkload(workload);
        }

        if (this.cronWorkloads.size > 0) {
            this.cronQueue = new Queue(CRON_QUEUE_NAME, { connection: this.connection });
            this.cronWorker = new Worker(
                CRON_QUEUE_NAME,
                (job) => this.runCron(job.name),
                { connection: this.connection, concurrency: 1 },
            );
            this.cronWorker.on('failed', (job, error) => {
                logger.error(`Cron "${job?.name}" run failed: ${error.message}`);
                Sentry.captureException(error);
            });
            this.cronWorker.on('error', (error) => {
                logger.error('Cron worker error:', error);
            });

            for (const cron of this.cronWorkloads.values()) {
                await this.cronQueue.upsertJobScheduler(
                    `cron:${cron.name}`,
                    scheduleToRepeat(cron.schedule),
                    {
                        name: cron.name,
                        opts: {
                            removeOnComplete: { count: CRON_KEEP_COMPLETED },
                            removeOnFail: { count: CRON_KEEP_FAILED },
                        },
                    },
                );
            }
        }

        logger.info(
            `Started ${this.workloads.size} workload(s) [${[...this.workloads.keys()].join(', ') || '—'}] ` +
            `and ${this.cronWorkloads.size} cron workload(s) [${[...this.cronWorkloads.keys()].join(', ') || '—'}]`,
        );
    }

    async trigger<T>(workloadName: string, data: T): Promise<void> {
        const workload = this.workloads.get(workloadName);
        if (!workload) {
            throw new Error(`Cannot trigger unknown workload "${workloadName}"`);
        }
        await this.producer.enqueue(workload.spec, data);
    }

    async status(workloadName: string): Promise<QueueCounts> {
        this.requireRegistered(workloadName);
        const counts = await this.producer.queue(workloadName).getJobCounts(
            'waiting',
            'active',
            'delayed',
            'completed',
            'failed',
            'paused',
            'prioritized',
            'waiting-children',
        );
        return {
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            completed: counts.completed ?? 0,
            failed: counts.failed ?? 0,
            paused: counts.paused ?? 0,
            prioritized: counts.prioritized ?? 0,
            'waiting-children': counts['waiting-children'] ?? 0,
        };
    }

    async jobDetail(workloadName: string, jobId: string): Promise<JobDetail | null> {
        this.requireRegistered(workloadName);
        const queue = this.producer.queue(workloadName);
        const job = await queue.getJob(jobId);
        if (!job) {
            return null;
        }

        const [state, jobLogs] = await Promise.all([
            job.getState(),
            queue.getJobLogs(jobId),
        ]);

        const enqueuedAt = job.timestamp;
        const startedAt = job.processedOn ?? null;
        const finishedAt = job.finishedOn ?? null;

        return {
            id: job.id ?? jobId,
            name: job.name,
            state: normalizeJobState(state),
            data: job.data,
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts.attempts ?? 1,
            result: job.returnvalue ?? null,
            failedReason: job.failedReason ?? null,
            stacktrace: job.stacktrace ?? [],
            logs: jobLogs.logs,
            enqueuedAt,
            startedAt,
            finishedAt,
            waitMs: startedAt !== null ? startedAt - enqueuedAt : null,
            runMs: startedAt !== null && finishedAt !== null ? finishedAt - startedAt : null,
        };
    }

    async stop(): Promise<void> {
        this.abortController.abort();

        const workers = [...this.workers.values()];
        if (this.cronWorker) {
            workers.push(this.cronWorker);
        }
        await Promise.all(workers.map((worker) =>
            Promise.race([
                worker.close(),
                new Promise((resolve) => setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS)),
            ]),
        ));

        if (this.cronQueue) {
            await this.cronQueue.close();
        }
        await this.producer.close();

        logger.info('Job manager stopped');
    }

    private startWorkload(workload: Workload<unknown, unknown>): void {
        const { spec, concurrency, rateLimit } = workload;

        this.producer.queue(spec.name);

        const worker = new Worker(
            spec.name,
            (job) => workload.process({
                data: job.data,
                jobId: job.id ?? '',
                attemptsMade: job.attemptsMade,
                maxAttempts: job.opts.attempts ?? 1,
                signal: this.abortController.signal,
                log: async (message) => { await job.log(message); },
                updateProgress: (progress) => job.updateProgress(progress),
            }),
            {
                connection: this.connection,
                concurrency,
                maxStalledCount: 1,
                ...(rateLimit
                    ? { limiter: { max: rateLimit.max, duration: parseDuration(rateLimit.per) } }
                    : {}),
            },
        );

        worker.on('failed', (job, error) => {
            void this.onWorkloadJobFailed(workload, job, error);
        });
        worker.on('error', (error) => {
            logger.error(`Worker "${spec.name}" error:`, error);
        });

        this.workers.set(spec.name, worker);
    }

    private async runCron(cronName: string): Promise<void> {
        const cron = this.cronWorkloads.get(cronName);
        if (!cron) {
            logger.warn(`Cron fired for unknown workload "${cronName}"; skipping`);
            return;
        }
        await cron.handler({
            trigger: (workload, data) => this.trigger(workload, data),
        });
    }

    private async onWorkloadJobFailed(
        workload: Workload<unknown, unknown>,
        job: Job | undefined,
        error: Error,
    ): Promise<void> {
        if (!job) {
            return;
        }
        const maxAttempts = job.opts.attempts ?? 1;
        const isTerminal = job.attemptsMade >= maxAttempts;
        if (!isTerminal) {
            logger.warn(`Workload "${workload.spec.name}" job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}; will retry: ${error.message}`);
            return;
        }
        logger.error(`Workload "${workload.spec.name}" job ${job.id} failed terminally after ${job.attemptsMade} attempt(s): ${error.message}`);
        try {
            await workload.onTerminalFailure?.(job.data, error);
        } catch (hookError) {
            Sentry.captureException(hookError);
            logger.error(`onTerminalFailure for workload "${workload.spec.name}" threw:`, hookError);
        }
    }

    private requireRegistered(workloadName: string): void {
        if (!this.workloads.has(workloadName)) {
            throw new Error(`Workload "${workloadName}" is not registered`);
        }
    }
}
