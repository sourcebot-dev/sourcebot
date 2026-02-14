import { PrismaClient } from "@sourcebot/db";
import { ArgumentParser } from "argparse";
import { migrateDuplicateConnections } from "./scripts/migrate-duplicate-connections";
import { injectAuditData } from "./scripts/inject-audit-data";
import { injectUserData } from "./scripts/inject-user-data";
import { confirmAction } from "./utils";
import { injectRepoData } from "./scripts/inject-repo-data";
import { testRepoQueryPerf } from "./scripts/test-repo-query-perf";

export interface Script {
    run: (prisma: PrismaClient) => Promise<void>;
}

export const scripts: Record<string, Script> = {
    "migrate-duplicate-connections": migrateDuplicateConnections,
    "inject-audit-data": injectAuditData,
    "inject-user-data": injectUserData,
    "inject-repo-data": injectRepoData,
    "test-repo-query-perf": testRepoQueryPerf,
}

const parser = new ArgumentParser();
parser.add_argument("--url", { required: true, help: "Database URL" });
parser.add_argument("--script", { required: true, help: "Script to run" });
const args = parser.parse_args();

(async () => {
    if (!(args.script in scripts)) {
        console.error("Invalid script");
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

