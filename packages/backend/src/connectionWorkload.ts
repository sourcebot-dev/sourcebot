import { Settings, Workload } from "./types.js";
import { ConnectionConfig } from "@sourcebot/schemas/v3/index.type";
import { compileAzureDevOpsConfig, compileBitbucketConfig, compileGenericGitHostConfig, compileGerritConfig, compileGiteaConfig, compileGithubConfig, compileGitlabConfig } from "./repoCompileUtils.js";
import { CONNECTION_QUEUE, env, loadConfig } from "@sourcebot/shared";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import * as Sentry from "@sentry/node";
import { ConnectionSyncJobStatus, PrismaClient } from "@sourcebot/db";

interface Props {
    db: PrismaClient,
    settings: Settings;
}

interface ConnectionSyncResult {
    reposToCleanup: { id: number; name: string }[];
    reposToIndex: { id: number; name: string }[];
}

export const createConnectionWorkload = ({
    db,
    settings
}: Props): Workload<'connection-sync', ConnectionSyncResult> => ({
    queueSpec: CONNECTION_QUEUE,
    concurrency: settings.maxConnectionSyncJobConcurrency,
    process: async ({
        data: {
            connectionId,
            orgId
        },
        logger,
        signal,
        jobId,
        trigger,
    }) => {
        logger.info(`Syncing connection ${connectionId}`, {
            connectionId,
            orgId,
        });
        const connection = await db.connection.findUniqueOrThrow({
            where: {
                id: connectionId
            }
        });

        const config = connection.config as unknown as ConnectionConfig;

        const result = await discoverConnectionRepositories({
            config,
            connectionId,
            signal,
        });

        let { repoData, warnings } = result;

        await db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                warningMessages: warnings,
            },
        });

        logger.info(`Discovered ${repoData.length} repositories`, {
            connectionId,
            repositoryCount: repoData.length,
        });

        // Filter out any duplicates by external_id and external_codeHostUrl.
        repoData = repoData.filter((repo, index, self) => {
            return index === self.findIndex(r =>
                r.external_id === repo.external_id &&
                r.external_codeHostUrl === repo.external_codeHostUrl
            );
        })

        const previouslyAssociatedRepos = await db.repo.findMany({
            where: {
                connections: {
                    some: {
                        connectionId,
                    },
                },
            },
            select: {
                id: true,
            },
        });

        const upsertedRepos: { id: number; name: string; indexedAt: Date | null }[] = [];

        for (const repo of repoData) {
            const upsertedRepo = await db.repo.upsert({
                where: {
                    external_id_external_codeHostUrl_orgId: {
                        external_id: repo.external_id,
                        external_codeHostUrl: repo.external_codeHostUrl,
                        orgId: orgId,
                    }
                },
                update: {
                    ...repo,
                    connections: {
                        createMany: {
                            data: {
                                connectionId,
                            },
                            skipDuplicates: true,
                        },
                    },
                },
                create: repo,
                select: {
                    id: true,
                    name: true,
                    indexedAt: true,
                },
            })
            upsertedRepos.push(upsertedRepo);
        }

        const currentRepoIds = new Set(upsertedRepos.map(({ id }) => id));
        const staleRepoIds = previouslyAssociatedRepos
            .map(({ id }) => id)
            .filter((id) => !currentRepoIds.has(id));

        if (staleRepoIds.length > 0) {
            await db.repoToConnection.deleteMany({
                where: {
                    connectionId,
                    repoId: {
                        in: staleRepoIds,
                    },
                },
            });
        }

        const reposToCleanup = staleRepoIds.length > 0
            ? await db.repo.findMany({
                where: {
                    id: {
                        in: staleRepoIds,
                    },
                    connections: {
                        none: {},
                    },
                },
                select: {
                    id: true,
                    name: true,
                },
            })
            : [];

        const reposToIndex = upsertedRepos
            .filter(({ indexedAt }) => indexedAt === null)
            .map(({ id, name }) => ({ id, name }));

        await Promise.all(reposToCleanup.map(({ id }) =>
            trigger('repo-index', {
                repoId: id,
                type: 'CLEANUP',
            })
        ));

        await Promise.all(reposToIndex.map(({ id }) =>
            trigger('repo-index', {
                repoId: id,
                type: 'INDEX',
            })
        ));

        logger.info(`Stored ${repoData.length} repositories`, {
            connectionId,
            connectionName: connection.name,
            repositoryCount: repoData.length,
        });

        await db.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncedAt: new Date(),
            }
        });

        // After a connection has synced, we need to re-sync the org's search contexts as
        // there may be new repos that match the search context's include/exclude patterns.
        try {
            const config = await loadConfig(env.CONFIG_PATH);

            await syncSearchContexts({
                orgId,
                contexts: config.contexts,
            });
        } catch (err) {
            logger.error(`Failed to sync search contexts for connection ${connectionId}`, err);
            Sentry.captureException(err);
        }

        logger.info(`Connection ${connectionId} sync finished`, {
            connectionId,
        });

        return {
            reposToCleanup,
            reposToIndex,
        };
    },
    onStarted: async ({ data: { connectionId }, jobId }) => {
        await db.connectionSyncJob.upsert({
            where: {
                id: jobId,
            },
            update: {
                status: ConnectionSyncJobStatus.IN_PROGRESS,
                completedAt: null,
                errorMessage: null,
                warningMessages: [],
            },
            create: {
                id: jobId,
                connectionId,
                status: ConnectionSyncJobStatus.IN_PROGRESS,
                warningMessages: [],
            },
        });
    },
    onCompleted: async ({ jobId }) => {
        await db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                status: ConnectionSyncJobStatus.COMPLETED,
                completedAt: new Date(),
                errorMessage: null,
            },
        });
    },
    onTerminalFailure: async ({ jobId }, error) => {
        await db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                status: ConnectionSyncJobStatus.FAILED,
                completedAt: new Date(),
                errorMessage: error.message,
            },
        });
    },
});

const discoverConnectionRepositories = async ({
    config,
    connectionId,
    signal,
}: {
    config: ConnectionConfig;
    connectionId: number;
    signal: AbortSignal;
}) => {
    switch (config.type) {
        case 'github': {
            return compileGithubConfig(config, connectionId, signal);
        }
        case 'gitlab': {
            return compileGitlabConfig(config, connectionId);
        }
        case 'gitea': {
            return compileGiteaConfig(config, connectionId);
        }
        case 'gerrit': {
            return compileGerritConfig(config, connectionId);
        }
        case 'bitbucket': {
            return compileBitbucketConfig(config, connectionId);
        }
        case 'azuredevops': {
            return compileAzureDevOpsConfig(config, connectionId);
        }
        case 'git': {
            return compileGenericGitHostConfig(config, connectionId);
        }
    }
};
