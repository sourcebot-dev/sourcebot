import { ArgumentParser } from "argparse";
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { isRemotePath } from "./utils.js";
import { AppContext } from "./types.js";
import { main } from "./main.js"
import { PrismaClient } from "@sourcebot/db";


const parser = new ArgumentParser({
    description: "Sourcebot backend tool",
});

type Arguments = {
    configPath: string;
    cacheDir: string;
}

parser.add_argument("--configPath", {
    help: "Path to config file",
    required: true,
});

parser.add_argument("--cacheDir", {
    help: "Path to .sourcebot cache directory",
    required: true,
});
const args = parser.parse_args() as Arguments;

if (!isRemotePath(args.configPath) && !existsSync(args.configPath)) {
    console.error(`Config file ${args.configPath} does not exist`);
    process.exit(1);
}

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
    configPath: args.configPath,
}

const prisma = new PrismaClient();

main(prisma, context)
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    })
    .finally(() => {
        console.log("Shutting down...");
    });
