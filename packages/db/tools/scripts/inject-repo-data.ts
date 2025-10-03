import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('inject-repo-data');

const NUM_REPOS = 100000;

export const injectRepoData: Script = {
    run: async (prisma: PrismaClient) => {
        const orgId = 1;
        
        // Check if org exists
        const org = await prisma.org.findUnique({
            where: { id: orgId }
        });

        if (!org) {
            await prisma.org.create({
                data: {
                    id: orgId,
                    name: 'Test Org',
                    domain: 'test-org.com'
                }
            });
        }

        const connection = await prisma.connection.create({
            data: {
                orgId,
                name: 'test-connection',
                connectionType: 'github',
                config: {}
            }
        });


        logger.info(`Creating ${NUM_REPOS} repos...`);

        for (let i = 0; i < NUM_REPOS; i++) {
            await prisma.repo.create({
                data: {
                    name: `test-repo-${i}`,
                    isFork: false,
                    isArchived: false,
                    metadata: {},
                    cloneUrl: `https://github.com/test-org/test-repo-${i}`,
                    webUrl: `https://github.com/test-org/test-repo-${i}`,
                    orgId,
                    external_id: `test-repo-${i}`,
                    external_codeHostType: 'github',
                    external_codeHostUrl: 'https://github.com',
                    connections: {
                        create: {
                            connectionId: connection.id,
                        }
                    }
                }
            });
        }

        logger.info(`Created ${NUM_REPOS} repos.`);
    }
}; 