import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";

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
        console.log(`Found ${allRepos.length} repos in ${durationMs}ms`);
    }
}; 