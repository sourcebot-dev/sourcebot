import { PrismaClient } from "@sourcebot/db";
import { ArgumentParser } from "argparse";
import { migrateDuplicateConnections } from "./scripts/migrate-duplicate-connections";
import { injectAuditData } from "./scripts/inject-audit-data";
import { confirmAction } from "./utils";
import { createLogger } from "@sourcebot/logger";

export interface Script {
    run: (prisma: PrismaClient) => Promise<void>;
}

export const scripts: Record<string, Script> = {
    "migrate-duplicate-connections": migrateDuplicateConnections,
    "inject-audit-data": injectAuditData,
}

const parser = new ArgumentParser();
parser.add_argument("--url", { required: true, help: "Database URL" });
parser.add_argument("--script", { required: true, help: "Script to run" });
const args = parser.parse_args();

const logger = createLogger('db-script-runner');

(async () => {
    if (!(args.script in scripts)) {
        logger.error("Invalid script");
        process.exit(1);
    }

    const selectedScript = scripts[args.script];

    logger.info("\nTo confirm:");
    logger.info(`- Database URL: ${args.url}`);
    logger.info(`- Script: ${args.script}`);

    confirmAction();

    const prisma = new PrismaClient({
        datasourceUrl: args.url,
    });

    await selectedScript.run(prisma);

    logger.info("\nDone.");
    process.exit(0);
})();

