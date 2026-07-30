import { createLogger, env } from '@sourcebot/shared';
import express, { Request, Response } from 'express';
import 'express-async-errors';
import * as http from "http";
import { PromClient } from './promClient.js';

const logger = createLogger('api');

const workerApiUrl = new URL(env.WORKER_API_URL);
const PORT = Number(workerApiUrl.port) || (workerApiUrl.protocol === "https:" ? 443 : 80);

export class Api {
    private server: http.Server;

    constructor(promClient: PromClient) {
        const app = express();
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Prometheus metrics endpoint
        app.use('/metrics', async (_req: Request, res: Response) => {
            res.set('Content-Type', promClient.registry.contentType);
            const metrics = await promClient.registry.metrics();
            res.end(metrics);
        });

        this.server = app.listen(PORT, () => {
            logger.debug(`API server is running on port ${PORT}`);
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
