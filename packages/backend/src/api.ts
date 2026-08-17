import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import {
    MetricsRecorder,
    RedisMetricsHistoryProvider,
} from '@bull-board/metrics';
import { Octokit } from '@octokit/rest';
import * as Sentry from "@sentry/node";
import { PrismaClient, RepoIndexingJobType } from '@sourcebot/db';
import { createLogger, env, JOB_PRIORITIES } from '@sourcebot/shared';
import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import type { Redis } from 'ioredis';
import * as http from "http";
import z from 'zod';
import { SINGLE_TENANT_ORG_ID } from './constants.js';
import { isGitHubRateLimitError, isNotFound } from './errors.js';
import { PromClient } from './promClient.js';
import { createGitHubRepoRecord } from './repoCompileUtils.js';
import type { JobManager, Settings } from './types.js';

const logger = createLogger('api');

const workerApiUrl = new URL(env.WORKER_API_URL);
const PORT = Number(workerApiUrl.port) || (workerApiUrl.protocol === "https:" ? 443 : 80);

export class Api {
    private server: http.Server;
    private metricsRecorder: MetricsRecorder;
    private metricsHistoryProvider: RedisMetricsHistoryProvider;

    constructor(
        promClient: PromClient,
        private prisma: PrismaClient,
        private jobManager: JobManager,
        redis: Redis,
        private settings: Settings,
    ) {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const bullBoardAdapter = new ExpressAdapter();
        bullBoardAdapter.setBasePath('/admin/queues');
        const queueAdapters = jobManager
            .getQueues()
            .map(queue => new BullMQAdapter(queue));
        this.metricsHistoryProvider = new RedisMetricsHistoryProvider({
            connection: redis,
        });
        this.metricsRecorder = new MetricsRecorder({
            queues: queueAdapters,
            connection: redis,
            onLatencyError: (error, queueName) => {
                logger.error(
                    `Failed to record BullMQ latency metrics for queue "${queueName}"`,
                    error,
                );
            },
        });
        createBullBoard({
            queues: queueAdapters,
            serverAdapter: bullBoardAdapter,
            options: { historyProvider: this.metricsHistoryProvider },
        });
        app.use('/admin/queues', bullBoardAdapter.getRouter());

        // Prometheus metrics endpoint
        app.use('/metrics', async (_req: Request, res: Response) => {
            res.set('Content-Type', promClient.registry.contentType);
            const metrics = await promClient.registry.metrics();
            res.end(metrics);
        });

        app.post(`/api/experimental/add-github-repo`, this.experimental_addGithubRepo.bind(this));

        app.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
            Sentry.captureException(error);
            next(error);
        });

        this.server = app.listen(PORT, () => {
            logger.debug(`API server is running on port ${PORT}`);
            logger.debug(`Bull Board is available at ${workerApiUrl.origin}/admin/queues`);
        });
        this.metricsRecorder.start();
    }

    private async experimental_addGithubRepo(req: Request, res: Response) {
        const schema = z.object({
            owner: z.string(),
            repo: z.string(),
        }).strict();

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const octokit = new Octokit({
            auth: env.EXPERIMENT_ASK_GH_GITHUB_TOKEN,
        });
        let response;
        try {
            response = await octokit.rest.repos.get({
                owner: parsed.data.owner,
                repo: parsed.data.repo,
            });
        } catch (error) {
            if (isNotFound(error)) {
                res.status(404).json({ error: 'Repository not found on GitHub' });
                return;
            }
            if (isGitHubRateLimitError(error)) {
                logger.warn(`GitHub API rate limit exceeded while adding ${parsed.data.owner}/${parsed.data.repo}`);
                res.status(429).json({ error: 'GitHub API rate limit exceeded' });
                return;
            }
            throw error;
        }

        const record = createGitHubRepoRecord({
            repo: response.data,
            hostUrl: 'https://github.com',
            isAutoCleanupDisabled: true,
        });

        const repo = await this.prisma.repo.upsert({
            where: {
                external_id_external_codeHostUrl_orgId: {
                    external_id: record.external_id,
                    external_codeHostUrl: record.external_codeHostUrl,
                    orgId: SINGLE_TENANT_ORG_ID,
                }
            },
            update: record,
            create: record,
        });

        const jobId = await scheduleAndTriggerRepoIndexing({
            jobManager: this.jobManager,
            repoId: repo.id,
            reindexIntervalMs: this.settings.reindexIntervalMs,
        });

        res.status(200).json({ jobId, repoId: repo.id });
    }

    public async dispose() {
        this.metricsRecorder.stop();
        this.metricsHistoryProvider.disconnect();

        return new Promise<void>((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve(undefined);
            });
        });
    }
}

const scheduleAndTriggerRepoIndexing = async ({
    jobManager,
    repoId,
    reindexIntervalMs,
}: {
    jobManager: JobManager;
    repoId: number;
    reindexIntervalMs: number;
}): Promise<string> => {
    await jobManager.upsertJobScheduler(
        "repo-index",
        `repo-index-v1-${repoId}`,
        reindexIntervalMs,
        {
            repoId,
            type: RepoIndexingJobType.INDEX,
        },
        { priority: JOB_PRIORITIES.SCHEDULED },
    );

    return jobManager.trigger(
        "repo-index",
        {
            repoId,
            type: RepoIndexingJobType.INDEX,
        },
        { priority: JOB_PRIORITIES.INTERACTIVE },
    );
};
