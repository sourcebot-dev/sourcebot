import * as Sentry from "@sentry/node";
import {
    BullMQClient,
    createBullMQJobLogger,
    createLogger,
    DataOf,
    JobEnqueueOptions,
    JobLogSink,
    QueueName,
    Schedule,
    scheduleToMs,
} from "@sourcebot/shared";
import { Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { WORKER_STOP_GRACEFUL_TIMEOUT_MS } from "./constants.js";
import { JobLifecycleContext, Workload } from "./types.js";
import type { JobManager } from "./types.js";
import { prisma } from "./prisma.js";

const LOG_TAG = "job-manager";
const logger = createLogger(LOG_TAG);

export class BullMQJobManager implements JobManager {
    private readonly workloads = new Map<
        string,
        Workload<QueueName, unknown>
    >();
    private readonly workers = new Map<string, Worker>();
    private readonly bullmqClient: BullMQClient;
    private readonly abortController = new AbortController();

    constructor(private readonly connection: Redis) {
        this.bullmqClient = new BullMQClient(connection);
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
        const { queueSpec: spec, concurrency, rateLimit, schedule } = workload;

        const worker = new Worker(
            spec.name,
            async (job) => {
                const jobLogger = createBullMQJobLogger(job, {
                    label: `${LOG_TAG}:${spec.name}:job:${job.id ?? "unknown"}`,
                });
                const lifecycleContext = this.jobLifecycleContext<TName>(
                    job,
                    jobLogger,
                );

                try {
                    await workload.onStarted?.(lifecycleContext);
                    const result = await workload.process({
                        ...lifecycleContext,
                        signal: this.abortController.signal,
                        updateProgress: (progress) =>
                            job.updateProgress(progress),
                        trigger: (target, data, options) =>
                            this.trigger(target, data, options),
                    });
                    return result;
                } catch (error) {
                    jobLogger.error(
                        `Workload "${spec.name}" attempt failed`,
                        error,
                    );
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
        const isTerminal = job.attemptsMade >= maxAttempts;
        if (!isTerminal) {
            logger.warn(
                `Workload "${workload.queueSpec.name}" job ${job.id} failed attempt ${job.attemptsMade}/${maxAttempts}; will retry: ${error.message}`,
            );
            return;
        }
        logger.error(
            `Workload "${workload.queueSpec.name}" job ${job.id} failed terminally after ${job.attemptsMade} attempt(s): ${error.message}`,
        );

        const jobLogger = createBullMQJobLogger(job, {
            label: `${LOG_TAG}:${workload.queueSpec.name}:job:${job.id ?? "unknown"}`,
            attempt: Math.max(job.attemptsMade, 1),
        });
        try {
            await workload.onTerminalFailure?.(
                this.jobLifecycleContext<TName>(job, jobLogger),
                error,
            );
        } catch (hookError) {
            Sentry.captureException(hookError);
            jobLogger.error(
                `onTerminalFailure for workload "${workload.queueSpec.name}" threw`,
                hookError,
            );
            logger.error(
                `onTerminalFailure for workload "${workload.queueSpec.name}" threw:`,
                hookError,
            );
        } finally {
            await jobLogger.flush();
        }
    }

    private async onWorkloadJobCompleted<TName extends QueueName, TResult>(
        workload: Workload<TName, TResult>,
        job: Job,
        result: TResult,
    ): Promise<void> {
        const jobLogger = createBullMQJobLogger(job, {
            label: `${LOG_TAG}:${workload.queueSpec.name}:job:${job.id ?? "unknown"}`,
            attempt: Math.max(job.attemptsMade, 1),
        });
        try {
            await workload.onCompleted?.(
                this.jobLifecycleContext<TName>(job, jobLogger),
                result,
            );
        } catch (hookError) {
            Sentry.captureException(hookError);
            jobLogger.error(
                `onCompleted for workload "${workload.queueSpec.name}" threw`,
                hookError,
            );
            logger.error(
                `onCompleted for workload "${workload.queueSpec.name}" threw:`,
                hookError,
            );
        } finally {
            await jobLogger.flush();
        }
    }

    private jobLifecycleContext<TName extends QueueName>(
        job: Job,
        logger: JobLogSink,
    ): JobLifecycleContext<TName> {
        return {
            data: job.data,
            jobId: job.id ?? "",
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts.attempts ?? 1,
            prisma,
            logger,
        };
    }
}
