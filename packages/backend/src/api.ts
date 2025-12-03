import { PrismaClient, RepoIndexingJobType } from '@sourcebot/db';
import { createLogger } from '@sourcebot/shared';
import express, { Request, Response } from 'express';
import 'express-async-errors';
import * as http from "http";
import z from 'zod';
import { ConnectionManager } from './connectionManager.js';
import { PromClient } from './promClient.js';
import { RepoIndexManager } from './repoIndexManager.js';
import { createGitHubRepoRecord } from './repoCompileUtils.js';
import { Octokit } from '@octokit/rest';

const logger = createLogger('api');
const PORT = 3060;

export class Api {
    private server: http.Server;

    constructor(
        promClient: PromClient,
        private prisma: PrismaClient,
        private connectionManager: ConnectionManager,
        private repoIndexManager: RepoIndexManager,
    ) {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Prometheus metrics endpoint
        app.use('/metrics', async (_req: Request, res: Response) => {
            res.set('Content-Type', promClient.registry.contentType);
            const metrics = await promClient.registry.metrics();
            res.end(metrics);
        });

        app.post('/api/sync-connection', this.syncConnection.bind(this));
        app.post('/api/index-repo', this.indexRepo.bind(this));
        app.post(`/api/experimental/add-github-repo`, this.addGithubRepo.bind(this));

        this.server = app.listen(PORT, () => {
            logger.info(`API server is running on port ${PORT}`);
        });
    }

    private async syncConnection(req: Request, res: Response) {
        const schema = z.object({
            connectionId: z.number(),
        }).strict();

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const { connectionId } = parsed.data;
        const connection = await this.prisma.connection.findUnique({
            where: {
                id: connectionId,
            }
        });

        if (!connection) {
            res.status(404).json({ error: 'Connection not found' });
            return;
        }

        const [jobId] = await this.connectionManager.createJobs([connection]);

        res.status(200).json({ jobId });
    }

    private async indexRepo(req: Request, res: Response) {
        const schema = z.object({
            repoId: z.number(),
        }).strict();

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const { repoId } = parsed.data;
        const repo = await this.prisma.repo.findUnique({
            where: { id: repoId },
        });

        if (!repo) {
            res.status(404).json({ error: 'Repo not found' });
            return;
        }

        const [jobId] = await this.repoIndexManager.createJobs([repo], RepoIndexingJobType.INDEX);
        res.status(200).json({ jobId });
    }

    private async addGithubRepo(req: Request, res: Response) {
        const schema = z.object({
            owner: z.string(),
            repo: z.string(),
        }).strict();

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const octokit = new Octokit();
        const response = await octokit.rest.repos.get({
            owner: parsed.data.owner,
            repo: parsed.data.repo,
        });

        const record = createGitHubRepoRecord({
            repo: response.data,
            hostUrl: 'https://github.com',
        });

        const repo = await this.prisma.repo.create({
            data: record,
        });

        const [jobId ] = await this.repoIndexManager.createJobs([repo], RepoIndexingJobType.INDEX);

        res.status(200).json({ jobId });
    }

    public async dispose() {
        return new Promise<void>((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve(undefined);
            });
        });
    }
}