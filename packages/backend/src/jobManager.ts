import * as Sentry from "@sentry/node";
import { createLogger } from "@sourcebot/shared";
import { Job, Worker } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { JobProducer } from "./jobProducer.js";
import { DataOf, JobDetail, JobManager, QueueCounts, QueueName, Schedule, Workload } from "./types.js";

const LOG_TAG = 'job-manager';
const logger = createLogger(LOG_TAG);

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

export class BullMQJobManager implements JobManager {
    private readonly workloads = new Map<string, Workload<QueueName, unknown>>();
    private readonly workers = new Map<string, Worker>();
    private readonly producer: JobProducer;
    private readonly abortController = new AbortController();

    constructor(private readonly connection: Redis) {
        this.producer = new JobProducer(connection);
    }

    register<TName extends QueueName>(workload: Workload<TName>): void {
        const name = workload.spec.name;
        if (this.workloads.has(name)) {
            throw new Error(`Workload "${name}" is already registered`);
        }
        this.workloads.set(name, workload);
    }

    async start(): Promise<void> {
        if (this.workloads.size === 0) {
            logger.debug('start() called with nothing registered; nothing to do');
            return;
        }

        for (const workload of this.workloads.values()) {
            await this.startWorkload(workload);
        }

        logger.info(
            `Started ${this.workloads.size} workload(s) [${[...this.workloads.keys()].join(', ')}]`,
        );
    }

    async trigger<TName extends QueueName>(
        workloadName: TName,
        data: DataOf<TName>
    ): Promise<void> {
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

        await Promise.all([...this.workers.values()].map((worker) =>
            Promise.race([
                worker.close(),
                new Promise((resolve) => setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS)),
            ]),
        ));

        await this.producer.close();

        logger.info('Job manager stopped');
    }

    private async startWorkload<TName extends QueueName>(workload: Workload<TName>): Promise<void> {
        const { spec, concurrency, rateLimit, schedule } = workload;

        const queue = this.producer.queue(spec.name);

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
                trigger: (target, data) => this.trigger(target, data),
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

        if (schedule) {
            // @note: jobs produced by BullMQ's scheduler bypass the deduplication check that
            // `Queue.add` goes through, so a dedup key would be silently ignored here. A
            // scheduled workload gets its overlap protection from `concurrency` instead: the
            // next tick's job is only created once the current one goes active, so at most one
            // run is ever queued behind the one in flight.
            await queue.upsertJobScheduler(
                `schedule:${spec.name}`,
                scheduleToRepeat(schedule),
                {
                    name: spec.name,
                    opts: {
                        attempts: spec.jobOptions.attempts,
                        removeOnComplete: { count: spec.jobOptions.keep.completed },
                        removeOnFail: { count: spec.jobOptions.keep.failed },
                    },
                },
            );
        }
    }

    private async onWorkloadJobFailed<TName extends QueueName>(
        workload: Workload<TName>,
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
