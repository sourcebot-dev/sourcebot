import * as Sentry from "@sentry/node";
import { BullMQClient, createBullMQJobLogger, createLogger, DataOf, JobLifecycleContext, QueueName } from "@sourcebot/shared";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { JobDetail, JobManager, Schedule, Workload } from "./types.js";
import { prisma } from "./prisma.js";

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
    private readonly bullmqClient: BullMQClient;
    private readonly abortController = new AbortController();

    constructor(private readonly connection: Redis) {
        this.bullmqClient = new BullMQClient(connection, prisma);
    }

    register<TName extends QueueName>(workload: Workload<TName>): void {
        const name = workload.queueSpec.name;
        if (this.workloads.has(name)) {
            throw new Error(`Workload "${name}" is already registered`);
        }
        this.workloads.set(name, workload);
    }

    getQueues(): Queue[] {
        return [...this.workloads.values()].map((workload) =>
            this.bullmqClient.getQueue(workload.queueSpec),
        );
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
    ): Promise<string> {
        const workload = this.workloads.get(workloadName) as Workload<TName> | undefined;
        if (!workload) {
            throw new Error(`Cannot trigger unknown workload "${workloadName}"`);
        }
        return this.bullmqClient.enqueue(workload.queueSpec, data);
    }

    async stop(): Promise<void> {
        this.abortController.abort();

        await Promise.all([...this.workers.values()].map((worker) =>
            Promise.race([
                worker.close(),
                new Promise((resolve) => setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS)),
            ]),
        ));

        await this.bullmqClient.close();

        logger.info('Job manager stopped');
    }

    private async startWorkload<TName extends QueueName>(workload: Workload<TName>): Promise<void> {
        const { queueSpec: spec, concurrency, rateLimit, schedule } = workload;

        const queue = this.bullmqClient.getQueue(spec);

        const worker = new Worker(
            spec.name,
            async (job) => {
                const jobLogger = createBullMQJobLogger(
                    job,
                    `${LOG_TAG}:${spec.name}:job:${job.id ?? 'unknown'}`,
                );
                const lifecycleContext = this.jobLifecycleContext<TName>(job);
                jobLogger.debug(`Started workload "${spec.name}"`);

                try {
                    await workload.onStarted?.(lifecycleContext);
                    const result = await workload.process({
                        ...lifecycleContext,
                        signal: this.abortController.signal,
                        logger: jobLogger,
                        updateProgress: (progress) => job.updateProgress(progress),
                        trigger: (target, data) => this.trigger(target, data),
                    });
                    jobLogger.debug(`Completed workload "${spec.name}"`);
                    return result;
                } catch (error) {
                    jobLogger.error(`Workload "${spec.name}" attempt failed`, error);
                    throw error;
                } finally {
                    await jobLogger.flush();
                }
            },
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
        worker.on('completed', (job, result) => {
            void this.onWorkloadJobCompleted(workload, job, result);
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
                        keepLogs: spec.jobOptions.keepLogs,
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
            logger.warn(`Workload "${workload.queueSpec.name}" job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}; will retry: ${error.message}`);
            return;
        }
        logger.error(`Workload "${workload.queueSpec.name}" job ${job.id} failed terminally after ${job.attemptsMade} attempt(s): ${error.message}`);

        try {
            await workload.onTerminalFailure?.(this.jobLifecycleContext<TName>(job), error);
        } catch (hookError) {
            Sentry.captureException(hookError);
            logger.error(`onTerminalFailure for workload "${workload.queueSpec.name}" threw:`, hookError);
        }
    }

    private async onWorkloadJobCompleted<TName extends QueueName, TResult>(
        workload: Workload<TName, TResult>,
        job: Job,
        result: TResult,
    ): Promise<void> {
        try {
            await workload.onCompleted?.(this.jobLifecycleContext<TName>(job), result);
        } catch (hookError) {
            Sentry.captureException(hookError);
            logger.error(`onCompleted for workload "${workload.queueSpec.name}" threw:`, hookError);
        }
    }

    private jobLifecycleContext<TName extends QueueName>(job: Job): JobLifecycleContext<TName> {
        return {
            data: job.data,
            jobId: job.id ?? '',
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts.attempts ?? 1,
            prisma,
        };
    }
}
