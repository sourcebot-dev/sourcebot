import "./instrument.js";

import * as Sentry from "@sentry/node";
import { ArgumentParser } from "argparse";
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { AppContext } from "./types.js";
import { main } from "./main.js"
import { PrismaClient } from "@sourcebot/db";

// Register handler for normal exit
process.on('exit', (code) => {
    console.log(`Process is exiting with code: ${code}`);
});

// Register handlers for abnormal terminations
process.on('SIGINT', () => {
    console.log('Process interrupted (SIGINT)');
    process.exit(130);
});

process.on('SIGTERM', () => {
    console.log('Process terminated (SIGTERM)');
    process.exit(143);
});

// Register handlers for uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.log(`Uncaught exception: ${err.message}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.log(`Unhandled rejection at: ${promise}, reason: ${reason}`);
    process.exit(1);
});


const parser = new ArgumentParser({
    description: "Sourcebot backend tool",
});

type Arguments = {
    cacheDir: string;
}

parser.add_argument("--cacheDir", {
    help: "Path to .sourcebot cache directory",
    required: true,
});
const args = parser.parse_args() as Arguments;

const cacheDir = args.cacheDir;
const reposPath = path.join(cacheDir, 'repos');
const indexPath = path.join(cacheDir, 'index');

if (!existsSync(reposPath)) {
    await mkdir(reposPath, { recursive: true });
}
if (!existsSync(indexPath)) {
    await mkdir(indexPath, { recursive: true });
}

const context: AppContext = {
    indexPath,
    reposPath,
    cachePath: cacheDir,
}

const prisma = new PrismaClient();

main(prisma, context)
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        Sentry.captureException(e);

        await prisma.$disconnect();
        process.exit(1);
    })
    .finally(() => {
        console.log("Shutting down...");
    });
