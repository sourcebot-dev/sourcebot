import { ConnectionSyncStatus, OrgRole, Prisma } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_USER_ID, SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_NAME, SINGLE_TENANT_USER_EMAIL } from './lib/constants';
import { readFile } from 'fs/promises';
import stripJsonComments from 'strip-json-comments';
import { SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { ConnectionConfig } from '@sourcebot/schemas/v3/connection.type';

if (env.SOURCEBOT_AUTH_ENABLED === 'false' && env.SOURCEBOT_TENANCY_MODE === 'multi') {
    throw new Error('SOURCEBOT_AUTH_ENABLED must be true when SOURCEBOT_TENANCY_MODE is multi');
}

const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

const initSingleTenancy = async () => {
    await prisma.org.upsert({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
        update: {},
        create: {
            name: SINGLE_TENANT_ORG_NAME,
            domain: SINGLE_TENANT_ORG_DOMAIN,
            id: SINGLE_TENANT_ORG_ID,
            isOnboarded: env.SOURCEBOT_AUTH_ENABLED === 'false',
        }
    });

    if (env.SOURCEBOT_AUTH_ENABLED === 'false') {
        // Default user for single tenancy unauthed access
        await prisma.user.upsert({
            where: {
                id: SINGLE_TENANT_USER_ID,
            },
            update: {},
            create: {
                id: SINGLE_TENANT_USER_ID,
                email: SINGLE_TENANT_USER_EMAIL,
            },
        });

        await prisma.org.update({
            where: {
                id: SINGLE_TENANT_ORG_ID,
            },
            data: {
                members: {
                    create: {
                        role: OrgRole.MEMBER,
                        user: {
                            connect: { id: SINGLE_TENANT_USER_ID }
                        }
                    }
                }
            }
        });
    }

    // Load any connections defined declaratively in the config file.
    const configPath = env.CONFIG_PATH;
    if (configPath) {
        const configContent = await (async () => {
            if (isRemotePath(configPath)) {
                const response = await fetch(configPath);
                if (!response.ok) {
                    throw new Error(`Failed to fetch config file ${configPath}: ${response.statusText}`);
                }
                return response.text();
            } else {
                return readFile(configPath, {
                    encoding: 'utf-8',
                });
            }
        })();
        
        const config = JSON.parse(stripJsonComments(configContent)) as SourcebotConfig;
        if (config.connections) {
            for (const [key, newConnectionConfig] of Object.entries(config.connections)) {
                const currentConnection = await prisma.connection.findUnique({
                    where: {
                        name_orgId: {
                            name: key,
                            orgId: SINGLE_TENANT_ORG_ID,
                        }
                    },
                    select: {
                        config: true,
                    }
                });

                const currentConnectionConfig = currentConnection ? currentConnection.config as unknown as ConnectionConfig : undefined;
                const syncNeededOnUpdate = currentConnectionConfig && JSON.stringify(currentConnectionConfig) !== JSON.stringify(newConnectionConfig);

                const connectionDb = await prisma.connection.upsert({
                    where: {
                        name_orgId: {
                            name: key,
                            orgId: SINGLE_TENANT_ORG_ID,
                        }
                    },
                    update: {
                        config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                        syncStatus: syncNeededOnUpdate ? ConnectionSyncStatus.SYNC_NEEDED : undefined,
                    },
                    create: {
                        name: key,
                        connectionType: newConnectionConfig.type,
                        config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                        org: {
                            connect: {
                                id: SINGLE_TENANT_ORG_ID,
                            }
                        }
                    }
                });

                console.log(`Upserted connection with name '${key}'. Connection ID: ${connectionDb.id}`);
            }
        }
    }
}

if (env.SOURCEBOT_TENANCY_MODE === 'single') {
    await initSingleTenancy();
}