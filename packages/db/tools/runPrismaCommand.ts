import { ArgumentParser } from "argparse";
import { spawn } from 'child_process';
import { confirmAction } from "./utils";

// This script is used to run a prisma command with a database URL.

const parser = new ArgumentParser({
    add_help: false,
});
parser.add_argument("--url", { required: true, help: "Database URL" });

// Parse known args to get the URL, but preserve the rest
const parsed = parser.parse_known_args();
const args = parsed[0];
const remainingArgs = parsed[1];

process.env.DATABASE_URL = args.url;

confirmAction(`command: prisma ${remainingArgs.join(' ')}\nurl: ${args.url}\n\nContinue? [N/y]`);

// Run prisma command with remaining arguments
const prisma = spawn('npx', ['prisma', ...remainingArgs], {
    stdio: 'inherit',
    env: process.env
});

prisma.on('exit', (code) => {
    process.exit(code);
});
