import { Script } from "../scriptRunner";
import { PrismaClient } from "../../dist";

const NUM_REPOS = 1000;
const NUM_PERMISSION_JOBS_PER_REPO = 10000;

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


    console.log(`Creating ${NUM_REPOS} repos...`);

    const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] as const;
    for (let i = 0; i < NUM_REPOS; i++) {
        const repo = await prisma.repo.create({
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

        for (let j = 0; j < NUM_PERMISSION_JOBS_PER_REPO; j++) {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            await prisma.repoPermissionSyncJob.create({
                data: {
                    repoId: repo.id,
                    status,
                    completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : null,
                    errorMessage: status === 'FAILED' ? 'Mock error message' : null
                }
            });
        }
    }

    console.log(`Created ${NUM_REPOS} repos with associated permission sync jobs.`);
    }
};
