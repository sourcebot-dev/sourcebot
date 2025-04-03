import { ConnectionSyncStatus, OrgRole, Prisma, RepoIndexingStatus } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_USER_ID, SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SINGLE_TENANT_ORG_NAME, SINGLE_TENANT_USER_EMAIL } from './lib/constants';
import { readFile } from 'fs/promises';
import { watch } from 'fs';
import stripJsonComments from 'strip-json-comments';
import { SearchContext, SourcebotConfig } from "@sourcebot/schemas/v3/index.type";
import { ConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { indexSchema } from '@sourcebot/schemas/v3/index.schema';
import Ajv from 'ajv';
import micromatch from 'micromatch';

const ajv = new Ajv({
    validateFormats: false,
});

if (env.SOURCEBOT_AUTH_ENABLED === 'false' && env.SOURCEBOT_TENANCY_MODE === 'multi') {
    throw new Error('SOURCEBOT_AUTH_ENABLED must be true when SOURCEBOT_TENANCY_MODE is multi');
}

const isRemotePath = (path: string) => {
    return path.startsWith('https://') || path.startsWith('http://');
}

const syncConnections = async (connections?: { [key: string]: ConnectionConfig }) => {
    if (connections) {
        for (const [key, newConnectionConfig] of Object.entries(connections)) {
            const currentConnection = await prisma.connection.findUnique({
                where: {
                    name_orgId: {
                        name: key,
                        orgId: SINGLE_TENANT_ORG_ID,
                    }
                },
                include: {
                    repos: {
                        include: {
                            repo: true,
                        }
                    }
                }
            });

            const currentConnectionConfig = currentConnection ? currentConnection.config as unknown as ConnectionConfig : undefined;
            const syncNeededOnUpdate =
                (currentConnectionConfig && JSON.stringify(currentConnectionConfig) !== JSON.stringify(newConnectionConfig)) ||
                (currentConnection?.syncStatus === ConnectionSyncStatus.FAILED);

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
                    isDeclarative: true,
                },
                create: {
                    name: key,
                    connectionType: newConnectionConfig.type,
                    config: newConnectionConfig as unknown as Prisma.InputJsonValue,
                    isDeclarative: true,
                    org: {
                        connect: {
                            id: SINGLE_TENANT_ORG_ID,
                        }
                    }
                }
            });

            console.log(`Upserted connection with name '${key}'. Connection ID: ${connectionDb.id}`);

            // Re-try any repos that failed to index.
            const failedRepos = currentConnection?.repos.filter(repo => repo.repo.repoIndexingStatus === RepoIndexingStatus.FAILED).map(repo => repo.repo.id) ?? [];
            if (failedRepos.length > 0) {
                await prisma.repo.updateMany({
                    where: {
                        id: {
                            in: failedRepos,
                        }
                    },
                    data: {
                        repoIndexingStatus: RepoIndexingStatus.NEW,
                    }
                })
            }
        }
    }

    // Delete any connections that are no longer in the config.
    const deletedConnections = await prisma.connection.findMany({
        where: {
            isDeclarative: true,
            name: {
                notIn: Object.keys(connections ?? {}),
            },
            orgId: SINGLE_TENANT_ORG_ID,
        }
    });

    for (const connection of deletedConnections) {
        console.log(`Deleting connection with name '${connection.name}'. Connection ID: ${connection.id}`);
        await prisma.connection.delete({
            where: {
                id: connection.id,
            }
        })
    }
}

const syncSearchContexts = async (contexts?: { [key: string]: SearchContext }) => {
    if (contexts) {
        for (const [key, newContextConfig] of Object.entries(contexts)) {
            const allRepos = await prisma.repo.findMany({
                where: {
                    orgId: SINGLE_TENANT_ORG_ID,
                },
                select: {
                    id: true,
                    name: true,
                }
            });

            let newReposInContext = allRepos.filter(repo => {
                return micromatch.isMatch(repo.name, newContextConfig.include);
            });

            if (newContextConfig.exclude) {
                const exclude = newContextConfig.exclude;
                newReposInContext = newReposInContext.filter(repo => {
                    return !micromatch.isMatch(repo.name, exclude);
                });
            }

            const currentReposInContext = (await prisma.searchContext.findUnique({
                where: {
                    name_orgId: {
                        name: key,
                        orgId: SINGLE_TENANT_ORG_ID,
                    }
                },
                include: {
                    repos: true,
                }
            }))?.repos ?? [];

            await prisma.searchContext.upsert({
                where: {
                    name_orgId: {
                        name: key,
                        orgId: SINGLE_TENANT_ORG_ID,
                    }
                },
                update: {
                    repos: {
                        connect: newReposInContext.map(repo => ({
                            id: repo.id,
                        })),
                        disconnect: currentReposInContext
                            .filter(repo => !newReposInContext.map(r => r.id).includes(repo.id))
                            .map(repo => ({
                                id: repo.id,
                            })),
                    },
                    description: newContextConfig.description,
                },
                create: {
                    name: key,
                    description: newContextConfig.description,
                    org: {
                        connect: {
                            id: SINGLE_TENANT_ORG_ID,
                        }
                    },
                    repos: {
                        connect: newReposInContext.map(repo => ({
                            id: repo.id,
                        })),
                    }
                }
            });
        }
    }

    const deletedContexts = await prisma.searchContext.findMany({
        where: {
            name: {
                notIn: Object.keys(contexts ?? {}),
            },
            orgId: SINGLE_TENANT_ORG_ID,
        }
    });

    for (const context of deletedContexts) {
        console.log(`Deleting search context with name '${context.name}'. ID: ${context.id}`);
        await prisma.searchContext.delete({
            where: {
                id: context.id,
            }
        })
    }
}

const syncDeclarativeConfig = async (configPath: string) => {
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
    const isValidConfig = ajv.validate(indexSchema, config);
    if (!isValidConfig) {
        throw new Error(`Config file '${configPath}' is invalid: ${ajv.errorsText(ajv.errors)}`);
    }

    await syncConnections(config.connections);
    await syncSearchContexts(config.contexts);
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
                    upsert: {
                        where: {
                            orgId_userId: {
                                orgId: SINGLE_TENANT_ORG_ID,
                                userId: SINGLE_TENANT_USER_ID,
                            }
                        },
                        update: {},
                        create: {
                            role: OrgRole.MEMBER,
                            user: {
                                connect: { id: SINGLE_TENANT_USER_ID }
                            }
                        }
                    }
                }
            }
        });
    }

    // Load any connections defined declaratively in the config file.
    const configPath = env.CONFIG_PATH;
    if (configPath) {
        await syncDeclarativeConfig(configPath);

        // watch for changes assuming it is a local file
        if (!isRemotePath(configPath)) {
            watch(configPath, () => {
                console.log(`Config file ${configPath} changed. Re-syncing...`);
                syncDeclarativeConfig(configPath);
            });
        }
    }
}

(async () => {
    if (env.SOURCEBOT_TENANCY_MODE === 'single') {
        await initSingleTenancy();
    }
})();
