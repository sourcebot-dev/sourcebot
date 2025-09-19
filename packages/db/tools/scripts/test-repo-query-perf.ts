import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('test-repo-query-perf');

export const testRepoQueryPerf: Script = {
    run: async (prisma: PrismaClient) => {


        const start = Date.now();
        const allRepos = await prisma.repo.findMany({
            where: {
                orgId: 1,
            },
            include: {
                connections: {
                    include: {
                        connection: true,
                    }
                }
            }
        });

        const durationMs = Date.now() - start;
        logger.info(`Found ${allRepos.length} repos in ${durationMs}ms`);
    }
}; 