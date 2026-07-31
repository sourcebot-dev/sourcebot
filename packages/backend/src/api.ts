import { createLogger, env } from '@sourcebot/shared';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import express, { NextFunction, Request, Response } from 'express';
import 'express-async-errors';
import * as http from "http";
import { PromClient } from './promClient.js';
import * as Sentry from "@sentry/node";

const logger = createLogger('api');

const workerApiUrl = new URL(env.WORKER_API_URL);
const PORT = Number(workerApiUrl.port) || (workerApiUrl.protocol === "https:" ? 443 : 80);

export class Api {
    private server: http.Server;

    constructor(promClient: PromClient, queues: Queue[]) {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        const bullBoardAdapter = new ExpressAdapter();
        bullBoardAdapter.setBasePath('/admin/queues');
        createBullBoard({
            queues: queues.map(queue => new BullMQAdapter(queue, { readOnlyMode: true })),
            serverAdapter: bullBoardAdapter,
        });
        app.use('/admin/queues', bullBoardAdapter.getRouter());

        // Prometheus metrics endpoint
        app.use('/metrics', async (_req: Request, res: Response) => {
            res.set('Content-Type', promClient.registry.contentType);
            const metrics = await promClient.registry.metrics();
            res.end(metrics);
        });

        app.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
            Sentry.captureException(error);
            next(error);
        });

        this.server = app.listen(PORT, () => {
            logger.debug(`API server is running on port ${PORT}`);
            logger.debug(`Bull Board is available at ${workerApiUrl.origin}/admin/queues`);
        });
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
