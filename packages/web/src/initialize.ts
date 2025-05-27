import { ConnectionSyncStatus, OrgRole, Prisma, RepoIndexingStatus } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SOURCEBOT_GUEST_USER_ID, SINGLE_TENANT_ORG_NAME } from './lib/constants';
import { watch } from 'fs';
import { ConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { hasEntitlement, loadConfig, isRemotePath, syncSearchContexts } from '@sourcebot/shared';
import { createGuestUser, setPublicAccessStatus } from '@/ee/features/publicAccess/publicAccess';
import { isServiceError } from './lib/utils';
import { ServiceErrorException } from './lib/serviceError';
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { createLogger } from "@sourcebot/logger";

const logger = createLogger('web-initialize');

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

            logger.info(`Upserted connection with name '${key}'. Connection ID: ${connectionDb.id}`);

            // Re-try any repos that failed to index.
            const failedRepos = currentConnection?.repos.filter(repo => repo.repo.repoIndexingStatus === RepoIndexingStatus.FAILED).map(repo => repo.repo.id) ?? [];
            if (failedRepos.length > 0) {
                for (let i = 0; i < failedRepos.length; i += 100) {
                    await prisma.repo.updateMany({
                        where: {
                            id: {
                                in: failedRepos.slice(i, i + 100),
                            }
                        },
                        data: {
                            repoIndexingStatus: RepoIndexingStatus.NEW,
                        }
                    })
                }
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
        logger.info(`Deleting connection with name '${connection.name}'. Connection ID: ${connection.id}`);
        await prisma.connection.delete({
            where: {
                id: connection.id,
            }
        })
    }
}

const syncDeclarativeConfig = async (configPath: string) => {
    const config = await loadConfig(configPath);

    const hasPublicAccessEntitlement = hasEntitlement("public-access");
    const enablePublicAccess = config.settings?.enablePublicAccess;
    if (enablePublicAccess !== undefined && !hasPublicAccessEntitlement) {
        logger.error(`Public access flag is set in the config file but your license doesn't have public access entitlement. Please contact ${SOURCEBOT_SUPPORT_EMAIL} to request a license upgrade.`);
        process.exit(1);
    }

    if (hasPublicAccessEntitlement) {
        if (enablePublicAccess && env.SOURCEBOT_EE_AUDIT_LOGGING_ENABLED === 'true') {
            logger.error(`Audit logging is not supported when public access is enabled. Please disable audit logging or disable public access.`);
            process.exit(1);
        }
        
        logger.info(`Setting public access status to ${!!enablePublicAccess} for org ${SINGLE_TENANT_ORG_DOMAIN}`);
        const res = await setPublicAccessStatus(SINGLE_TENANT_ORG_DOMAIN, !!enablePublicAccess);
        if (isServiceError(res)) {
            throw new ServiceErrorException(res);
        }
    }

    await syncConnections(config.connections);
    await syncSearchContexts({
        contexts: config.contexts,
        orgId: SINGLE_TENANT_ORG_ID,
        db: prisma,
    });
}

const pruneOldGuestUser = async () => {
    // The old guest user doesn't have the GUEST role
    const guestUser = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: SINGLE_TENANT_ORG_ID,
                userId: SOURCEBOT_GUEST_USER_ID,
            },
            role: {
                not: OrgRole.GUEST,
            }
        },
    });

    if (guestUser) {
        await prisma.user.delete({
            where: {
                id: guestUser.userId,
            },
        });

        logger.info(`Deleted old guest user ${guestUser.userId}`);
    }
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
            id: SINGLE_TENANT_ORG_ID
        }
    });

    // This is needed because v4 introduces the GUEST org role as well as making authentication required. 
    // To keep things simple, we'll just delete the old guest user if it exists in the DB
    await pruneOldGuestUser();

    const hasPublicAccessEntitlement = hasEntitlement("public-access");
    if (hasPublicAccessEntitlement) {
        const res = await createGuestUser(SINGLE_TENANT_ORG_DOMAIN);
        if (isServiceError(res)) {
            throw new ServiceErrorException(res);
        }
    }

    // Load any connections defined declaratively in the config file.
    const configPath = env.CONFIG_PATH;
    if (configPath) {
        // If we're given a config file, mark the org as onboarded so we don't go through
        // the UI connection onboarding flow
        await prisma.org.update({
            where: {
                id: SINGLE_TENANT_ORG_ID,
            },
            data: {
                isOnboarded: true,
            }
        });
        
        await syncDeclarativeConfig(configPath);
        
        // watch for changes assuming it is a local file
        if (!isRemotePath(configPath)) {
            watch(configPath, () => {
                logger.info(`Config file ${configPath} changed. Re-syncing...`);
                syncDeclarativeConfig(configPath);
            });
        }
    }
}

const initMultiTenancy = async () => {
    const hasMultiTenancyEntitlement = hasEntitlement("multi-tenancy");
    if (!hasMultiTenancyEntitlement) {
        logger.error(`SOURCEBOT_TENANCY_MODE is set to ${env.SOURCEBOT_TENANCY_MODE} but your license doesn't have multi-tenancy entitlement. Please contact ${SOURCEBOT_SUPPORT_EMAIL} to request a license upgrade.`);
        process.exit(1);
    }
}

(async () => {
    if (env.SOURCEBOT_TENANCY_MODE === 'single') {
        await initSingleTenancy();
    } else if (env.SOURCEBOT_TENANCY_MODE === 'multi') {
        await initMultiTenancy();
    } else {
        throw new Error(`Invalid SOURCEBOT_TENANCY_MODE: ${env.SOURCEBOT_TENANCY_MODE}`);
    }
})();
