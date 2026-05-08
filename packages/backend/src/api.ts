import { PrismaClient, RepoIndexingJobType } from '@sourcebot/db';
import { createLogger, env, hasEntitlement, PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS } from '@sourcebot/shared';
import express, { Request, Response } from 'express';
import 'express-async-errors';
import * as http from "http";
import { ConnectionManager } from './connectionManager.js';
import { AccountPermissionSyncer } from './ee/accountPermissionSyncer.js';
import { PromClient } from './promClient.js';
import { RepoIndexManager } from './repoIndexManager.js';
import { createGitHubRepoRecord } from './repoCompileUtils.js';
import { Octokit } from '@octokit/rest';
import { SINGLE_TENANT_ORG_ID } from './constants.js';
import z from 'zod';

const logger = createLogger('api');
const PORT = 3060;

export class Api {
    private server: http.Server;

    constructor(
        promClient: PromClient,
        private prisma: PrismaClient,
        private connectionManager: ConnectionManager,
        private repoIndexManager: RepoIndexManager,
        private accountPermissionSyncer: AccountPermissionSyncer,
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
        app.post('/api/trigger-account-permission-sync', this.triggerAccountPermissionSync.bind(this));
        app.post(`/api/experimental/add-github-repo`, this.experimental_addGithubRepo.bind(this));

        this.server = app.listen(PORT, () => {
            logger.debug(`API server is running on port ${PORT}`);
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

    private async triggerAccountPermissionSync(req: Request, res: Response) {
        if (env.PERMISSION_SYNC_ENABLED !== 'true' || !hasEntitlement('permission-syncing')) {
            res.status(403).json({ error: 'Permission syncing is not enabled.' });
            return;
        }

        const schema = z.object({
            accountId: z.string(),
        }).strict();

        const parsed = schema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.message });
            return;
        }

        const { accountId } = parsed.data;
        const account = await this.prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            res.status(404).json({ error: 'Account not found' });
            return;
        }

        if (!PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS.includes(account.provider as typeof PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS[number])) {
            res.status(400).json({ error: `Provider '${account.provider}' does not support permission syncing.` });
            return;
        }

        const jobId = await this.accountPermissionSyncer.schedulePermissionSyncForAccount(account);
        res.status(200).json({ jobId });
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

        const octokit = new Octokit();
        const response = await octokit.rest.repos.get({
            owner: parsed.data.owner,
            repo: parsed.data.repo,
        });

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

        const [jobId ] = await this.repoIndexManager.createJobs([repo], RepoIndexingJobType.INDEX);

        res.status(200).json({ jobId, repoId: repo.id });
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
