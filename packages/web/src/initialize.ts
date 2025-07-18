import { ConnectionSyncStatus, OrgRole, Prisma, RepoIndexingStatus } from '@sourcebot/db';
import { env } from './env.mjs';
import { prisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID, SINGLE_TENANT_ORG_DOMAIN, SOURCEBOT_GUEST_USER_ID, SINGLE_TENANT_ORG_NAME } from './lib/constants';
import { watch } from 'fs';
import { ConnectionConfig } from '@sourcebot/schemas/v3/connection.type';
import { hasEntitlement, loadConfig, isRemotePath, syncSearchContexts } from '@sourcebot/shared';
import { isServiceError } from './lib/utils';
import { ServiceErrorException } from './lib/serviceError';
import { SOURCEBOT_SUPPORT_EMAIL } from "@/lib/constants";
import { createLogger } from "@sourcebot/logger";
import { createGuestUser } from '@/lib/authUtils';
import { getOrgFromDomain } from './data/org';
import { getOrgMetadata } from './types';

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

    if (env.FORCE_ENABLE_ANONYMOUS_ACCESS === 'true') {
        const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
        if (!hasAnonymousAccessEntitlement) {
            logger.warn(`FORCE_ENABLE_ANONYMOUS_ACCESS env var is set to true but anonymous access entitlement is not available. Setting will be ignored.`);
        } else {
            const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
            if (org) {
                const currentMetadata = getOrgMetadata(org);
                const mergedMetadata = {
                    ...(currentMetadata ?? {}),
                    anonymousAccessEnabled: true,
                };
                
                await prisma.org.update({
                    where: { id: org.id },
                    data: { 
                        metadata: mergedMetadata,
                    },
                });
                logger.info(`Anonymous access enabled via FORCE_ENABLE_ANONYMOUS_ACCESS environment variable`);
            }
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
    // Back fill the inviteId if the org has already been created to prevent needing to wipe the db
    await prisma.$transaction(async (tx) => {
        const org = await tx.org.findUnique({
            where: {
                id: SINGLE_TENANT_ORG_ID,
            },
        });

        if (!org) {
            await tx.org.create({
                data: {
                    id: SINGLE_TENANT_ORG_ID,
                    name: SINGLE_TENANT_ORG_NAME,
                    domain: SINGLE_TENANT_ORG_DOMAIN,
                    inviteLinkId: crypto.randomUUID(),
                }
            });
        } else if (!org.inviteLinkId) {
            await tx.org.update({
                where: {
                    id: SINGLE_TENANT_ORG_ID,
                },
                data: {
                    inviteLinkId: crypto.randomUUID(),
                }
            });
        }
    });

    // This is needed because v4 introduces the GUEST org role as well as making authentication required. 
    // To keep things simple, we'll just delete the old guest user if it exists in the DB
    await pruneOldGuestUser();

    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
    if (hasAnonymousAccessEntitlement) {
        const res = await createGuestUser(SINGLE_TENANT_ORG_DOMAIN);
        if (isServiceError(res)) {
            throw new ServiceErrorException(res);
        }
    } else {
        // If anonymous access entitlement is not enabled, set the flag to false in the org on init
        const org = await getOrgFromDomain(SINGLE_TENANT_ORG_DOMAIN);
        if (org) {
            await prisma.org.update({
                where: { id: org.id },
                data: { metadata: { anonymousAccessEnabled: false } },
            });
        }
    }

    // Load any connections defined declaratively in the config file.
    const configPath = env.CONFIG_PATH;
    if (configPath) {
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
