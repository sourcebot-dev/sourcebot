import * as Sentry from "@sentry/node";
import {
    BullMQClient,
    createBullMQJobLogSink,
    createLogger,
    DataOf,
    JobEnqueueOptions,
    QueueName,
    Schedule,
    scheduleToMs,
    runWithJobLogContext,
} from "@sourcebot/shared";
import { Job, MetricsTime, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { createExecutionLockRunner } from "./executionLock.js";
import type { ExecutionLockRunner } from "./executionLock.js";
import { JobLifecycleContext, Workload } from "./types.js";
import type { JobManager } from "./types.js";
import { prisma } from "./prisma.js";

const LOG_TAG = "job-manager";
const STALLED_JOB_TERMINAL_ERROR = "job stalled more than allowable limit";
const logger = createLogger(LOG_TAG);

export class BullMQJobManager implements JobManager {
    private readonly workloads = new Map<
        string,
        Workload<QueueName, unknown>
    >();
    private readonly workers = new Map<string, Worker>();
    private readonly bullmqClient: BullMQClient;
    private readonly abortController = new AbortController();
    private readonly executionLockRunner: ExecutionLockRunner;

    constructor(private readonly connection: Redis) {
        this.bullmqClient = new BullMQClient(connection);
        this.executionLockRunner = createExecutionLockRunner(connection);
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
            logger.debug(
                "start() called with nothing registered; nothing to do",
            );
            return;
        }

        for (const workload of this.workloads.values()) {
            await this.startWorkload(workload);
        }

        logger.info(
            `Started ${this.workloads.size} workload(s) [${[...this.workloads.keys()].join(", ")}]`,
        );
    }

    async trigger<TName extends QueueName>(
        workloadName: TName,
        data: DataOf<TName>,
        options?: JobEnqueueOptions,
    ): Promise<string> {
        const workload = this.getWorkload(workloadName);
        return this.bullmqClient.enqueue(workload.queueSpec, data, options);
    }

    async upsertJobScheduler<TName extends QueueName>(
        workloadName: TName,
        schedulerId: string,
        schedule: Schedule,
        data: DataOf<TName>,
        options?: JobEnqueueOptions,
    ): Promise<string> {
        const workload = this.getWorkload(workloadName);
        return this.bullmqClient.upsertJobScheduler(
            workload.queueSpec,
            schedulerId,
            schedule,
            data,
            options,
        );
    }

    async getJobSchedulerIds<TName extends QueueName>(
        workloadName: TName,
    ): Promise<string[]> {
        const workload = this.getWorkload(workloadName);
        return this.bullmqClient.getJobSchedulerIds(workload.queueSpec);
    }

    async removeJobScheduler<TName extends QueueName>(
        workloadName: TName,
        schedulerId: string,
    ): Promise<boolean> {
        const workload = this.getWorkload(workloadName);
        return this.bullmqClient.removeJobScheduler(
            workload.queueSpec,
            schedulerId,
        );
    }

    async stop(): Promise<void> {
        this.abortController.abort();

        await Promise.all(
            [...this.workers.values()].map((worker) =>
                Promise.race([
                    worker.close(),
                    new Promise((resolve) =>
                        setTimeout(resolve, WORKER_STOP_GRACEFUL_TIMEOUT_MS),
                    ),
                ]),
            ),
        );

        await this.bullmqClient.close();

        logger.info("Job manager stopped");
    }

    private async startWorkload<TName extends QueueName>(
        workload: Workload<TName>,
    ): Promise<void> {
        const {
            queueSpec: spec,
            concurrency,
            executionLock,
            rateLimit,
            schedule,
        } = workload;

        const worker = new Worker(
            spec.name,
            async (job) => {
                const label = `${LOG_TAG}:${spec.name}:job:${job.id ?? "unknown"}`;
                const jobLogSink = createBullMQJobLogSink(job, { label });
                const lifecycleContext = this.jobLifecycleContext<TName>(job);

                const process = async (signal: AbortSignal) => {
                    await workload.onStarted?.(lifecycleContext);
                    return workload.process({
                        ...lifecycleContext,
                        signal,
                        updateProgress: (progress) =>
                            job.updateProgress(progress),
                        trigger: (target, data, options) =>
                            this.trigger(target, data, options),
                    });
                };

                return runWithJobLogContext(
                    {
                        jobId: job.id ?? "",
                        queueName: spec.name,
                        attempt: job.attemptsMade + 1,
                        sink: jobLogSink,
                    },
                    async () => {
                        try {
                            if (executionLock) {
                                const resource = executionLock.resource(job.data);
                                const waitStartedAt = Date.now();
                                return await this.executionLockRunner.using(
                                    resource,
                                    executionLock.durationMs,
                                    this.abortController.signal,
                                    async (signal) => {
                                        const acquiredAt = Date.now();
                                        logger.debug(
                                            "Acquired workload execution lock",
                                            {
                                                resource,
                                                lockWaitMs: acquiredAt - waitStartedAt,
                                            },
                                        );

                                        try {
                                            return await process(signal);
                                        } finally {
                                            logger.debug(
                                                "Finished work protected by execution lock",
                                                {
                                                    resource,
                                                    lockHeldMs: Date.now() - acquiredAt,
                                                },
                                            );
                                        }
                                    },
                                );
                            }

                            return await process(this.abortController.signal);
                        } catch (error) {
                            logger.error(
                                `Workload "${spec.name}" attempt failed`,
                                error,
                            );
                            throw error;
                        } finally {
                            await jobLogSink.flush();
                        }
                    },
                );
            },
            {
                connection: this.connection,
                concurrency,
                maxStalledCount: 1,
                metrics: { maxDataPoints: MetricsTime.ONE_WEEK },
                ...(rateLimit
                    ? {
                          limiter: {
                              max: rateLimit.max,
                              duration: scheduleToMs(rateLimit.per),
                          },
                      }
                    : {}),
            },
        );

        worker.on("failed", (job, error) => {
            void this.onWorkloadJobFailed(workload, job, error);
        });
        worker.on("completed", (job, result) => {
            void this.onWorkloadJobCompleted(workload, job, result);
        });
        worker.on("error", (error) => {
            logger.error(`Worker "${spec.name}" error:`, error);
        });

        this.workers.set(spec.name, worker);

        if (schedule) {
            // @note: jobs produced by BullMQ's scheduler bypass the deduplication check that
            // `Queue.add` goes through, so a dedup key would be silently ignored here. The
            // next tick's job is only created once the current one goes active, so at most one
            // run is ever queued behind the one in flight.
            await this.upsertJobScheduler(
                spec.name,
                `schedule:${spec.name}`,
                schedule.interval,
                schedule.data,
                schedule.options,
            );
        }
    }

    private getWorkload<TName extends QueueName>(
        workloadName: TName,
    ): Workload<TName> {
        const workload = this.workloads.get(workloadName) as
            | Workload<TName>
            | undefined;
        if (!workload) {
            throw new Error(`Unknown workload "${workloadName}"`);
        }
        return workload;
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
        const isTerminal =
            job.attemptsMade >= maxAttempts ||
            error.message === STALLED_JOB_TERMINAL_ERROR;
        if (!isTerminal) {
            logger.warn(
                `Workload "${workload.queueSpec.name}" job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}; will retry: ${error.message}`,
            );
            return;
        }
        logger.error(
            `Workload "${workload.queueSpec.name}" job ${job.id} failed terminally after ${job.attemptsMade} attempt(s): ${error.message}`,
        );

        const label = `${LOG_TAG}:${workload.queueSpec.name}:job:${job.id ?? "unknown"}`;
        const attempt = Math.max(job.attemptsMade, 1);
        const jobLogSink = createBullMQJobLogSink(job, {
            label,
            attempt,
        });
        await runWithJobLogContext(
            {
                jobId: job.id ?? "",
                queueName: workload.queueSpec.name,
                attempt,
                sink: jobLogSink,
            },
            async () => {
                try {
                    await workload.onTerminalFailure?.(
                        this.jobLifecycleContext<TName>(job),
                        error,
                    );
                } catch (hookError) {
                    Sentry.captureException(hookError);
                    logger.error(
                        `onTerminalFailure for workload "${workload.queueSpec.name}" threw`,
                        hookError,
                    );
                } finally {
                    await jobLogSink.flush();
                }
            },
        );
    }

    private async onWorkloadJobCompleted<TName extends QueueName, TResult>(
        workload: Workload<TName, TResult>,
        job: Job,
        result: TResult,
    ): Promise<void> {
        const label = `${LOG_TAG}:${workload.queueSpec.name}:job:${job.id ?? "unknown"}`;
        const attempt = Math.max(job.attemptsMade, 1);
        const jobLogSink = createBullMQJobLogSink(job, {
            label,
            attempt,
        });
        await runWithJobLogContext(
            {
                jobId: job.id ?? "",
                queueName: workload.queueSpec.name,
                attempt,
                sink: jobLogSink,
            },
            async () => {
                try {
                    await workload.onCompleted?.(
                        this.jobLifecycleContext<TName>(job),
                        result,
                    );
                } catch (hookError) {
                    Sentry.captureException(hookError);
                    logger.error(
                        `onCompleted for workload "${workload.queueSpec.name}" threw`,
                        hookError,
                    );
                } finally {
                    await jobLogSink.flush();
                }
            },
        );
    }

    private jobLifecycleContext<TName extends QueueName>(
        job: Job,
    ): JobLifecycleContext<TName> {
        return {
            data: job.data,
            jobId: job.id ?? "",
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts.attempts ?? 1,
            prisma,
        };
    }
}
