import { PrismaClient, RepoIndexingJobType } from '@sourcebot/db';
import { createLogger } from '@sourcebot/shared';
import express, { Request, Response } from 'express';
import 'express-async-errors';
import * as http from "http";
import z from 'zod';
import { ConnectionManager } from './connectionManager.js';
import { PromClient } from './promClient.js';
import { RepoIndexManager } from './repoIndexManager.js';
import { TypesenseService } from './search/typesense.js';

const logger = createLogger('api');
const PORT = 3060;

export class Api {
    private server: http.Server;
    private typesenseService: TypesenseService;

    constructor(
        promClient: PromClient,
        private prisma: PrismaClient,
        private connectionManager: ConnectionManager,
        private repoIndexManager: RepoIndexManager,
    ) {
        this.typesenseService = new TypesenseService();
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
        app.get('/api/search/fuzzy', this.fuzzySearch.bind(this));

        this.server = app.listen(PORT, () => {
            logger.info(`API server is running on port ${PORT}`);
        });
    }

    private async fuzzySearch(req: Request, res: Response) {
        const schema = z.object({
            q: z.string().min(1),
            type: z.enum(['repo', 'file', 'commit']).optional().default('repo'),
            repoId: z.string().transform(val => parseInt(val)).optional(),
        });

        const parsed = schema.safeParse(req.query);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const { q, type, repoId } = parsed.data;

        try {
            const results = await this.typesenseService.search(q, type, repoId);
            res.status(200).json(results);
        } catch (error) {
            logger.error('Fuzzy search failed', error);
            res.status(500).json({ error: 'Internal server error during search' });
        }
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

    public async dispose() {
        return new Promise<void>((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve(undefined);
            });
        });
    }
}