import { PrismaClient } from "@sourcebot/db";
import { ArgumentParser } from "argparse";
import { migrateDuplicateConnections } from "./scripts/migrate-duplicate-connections";
import { confirmAction } from "./utils";

export interface Script {
    run: (prisma: PrismaClient) => Promise<void>;
}

export const scripts: Record<string, Script> = {
    "migrate-duplicate-connections": migrateDuplicateConnections,
}

const parser = new ArgumentParser();
parser.add_argument("--url", { required: true, help: "Database URL" });
parser.add_argument("--script", { required: true, help: "Script to run" });
const args = parser.parse_args();

(async () => {
    if (!(args.script in scripts)) {
        console.log("Invalid script");
        process.exit(1);
    }

    const selectedScript = scripts[args.script];

    console.log("\nTo confirm:");
    console.log(`- Database URL: ${args.url}`);
    console.log(`- Script: ${args.script}`);

    confirmAction();

    const prisma = new PrismaClient({
        datasourceUrl: args.url,
    });

    await selectedScript.run(prisma);

    console.log("\nDone.");
    process.exit(0);
})();

