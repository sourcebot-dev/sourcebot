import "./instrument.js";

import * as Sentry from "@sentry/node";
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { AppContext } from "./types.js";
import { main } from "./main.js"
import { PrismaClient } from "@sourcebot/db";
import { env } from "./env.js";
import { createLogger } from "@sourcebot/logger";
import { isRemotePath } from './utils.js';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { SourcebotConfig } from '@sourcebot/schemas/v3/index.type';
import { indexSchema } from '@sourcebot/schemas/v3/index.schema';
import { Ajv } from "ajv";

const logger = createLogger('backend-entrypoint');
const ajv = new Ajv({
    validateFormats: false,
});

const loadConfig = async (configPath?: string) => {
    if (!configPath) {
        return undefined;
    }

    const configContent = await (async () => {
        if (isRemotePath(configPath)) {
            const response = await fetch(configPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
            }
            return response.text();
        } else {
            return readFile(configPath, { encoding: 'utf-8' });
        }
    })();

    const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfig;
    const isValidConfig = ajv.validate(indexSchema, config);
    if (!isValidConfig) {
        throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
    }

    return config;
}

// Register handler for normal exit
process.on('exit', (code) => {
    logger.info(`Process is exiting with code: ${code}`);
});

// Register handlers for abnormal terminations
process.on('SIGINT', () => {
    logger.info('Process interrupted (SIGINT)');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('Process terminated (SIGTERM)');
    process.exit(0);
});

// Register handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});

const cacheDir = env.DATA_CACHE_DIR;
const reposPath = path.join(cacheDir, 'repos');
const indexPath = path.join(cacheDir, 'index');

if (!existsSync(reposPath)) {
    await mkdir(reposPath, { recursive: true });
}
if (!existsSync(indexPath)) {
    await mkdir(indexPath, { recursive: true });
}

const config = await loadConfig(env.CONFIG_PATH);

const context: AppContext = {
    indexPath,
    reposPath,
    cachePath: cacheDir,
    config,
}

const prisma = new PrismaClient();

main(prisma, context)
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        logger.error(e);
        Sentry.captureException(e);

        await prisma.$disconnect();
        process.exit(1);
    })
    .finally(() => {
        logger.info("Shutting down...");
    });

