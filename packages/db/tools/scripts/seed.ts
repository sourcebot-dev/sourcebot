import { ConnectionSyncStatus, Prisma, PrismaClient, RepoIndexingStatus } from "@prisma/client";
import { v4 as uuidv4 } from 'uuid';
import { Script } from "../scriptRunner";

const TEST_ORG_ID = 1;
const TEST_CONNECTION_ID = 1;

export const seed: Script = {
    run: async (prisma: PrismaClient) => {

        const org = await prisma.org.findUnique({
            where: {
                id: TEST_ORG_ID,
            }
        });

        if (!org) {
            await prisma.org.create({
                data: {
                    id: TEST_ORG_ID,
                    name: 'Test Org',
                    domain: 'test-org.com',
                }
            });
        }

        const connection = await prisma.connection.findUnique({
            where: {
                id: TEST_CONNECTION_ID,
            }
        });

        if (!connection) {
            await prisma.connection.create({
                data: {
                    id: TEST_CONNECTION_ID,
                    name: 'Test Connection',
                    orgId: TEST_ORG_ID,
                    syncedAt: new Date(),
                    syncStatus: ConnectionSyncStatus.SYNCED,
                    config: {} as unknown as Prisma.InputJsonValue,
                    connectionType: 'github',
                }
            });
        }
        
        for (let i = 0; i < 20000; i++) {
            const name = uuidv4();
            await prisma.repo.create({
                data: {
                    name: name,
                    orgId: TEST_ORG_ID,
                    external_id: name,
                    external_codeHostType: 'github',
                    external_codeHostUrl: 'https://github.com',
                    repoIndexingStatus: RepoIndexingStatus.INDEXED,
                    isFork: false,
                    isArchived: false,
                    indexedAt: new Date(),
                    metadata: {},
                    cloneUrl: 'https://github.com/sourcebot-dev/sourcebot-does-not-exist.git',
                    connections: {
                        create: {
                            addedAt: new Date(),
                            connectionId: TEST_CONNECTION_ID,
                        }
                    }
                }
            });
        }
    }
};
