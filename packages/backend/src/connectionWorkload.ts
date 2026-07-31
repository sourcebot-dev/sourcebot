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

export const createConnectionWorkload = ({
    db,
    settings
}: Props): Workload<'connection-sync'> => ({
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

        // @note: to handle orphaned Repos we delete all RepoToConnection records for this connection,
        // and then recreate them when we upsert the repos. For example, if a repo is no-longer
        // captured by the connection's config (e.g., it was deleted, marked archived, etc.), it won't
        // appear in the repoData array above, and so the RepoToConnection record won't be re-created.
        // Repos that have no RepoToConnection records are considered orphaned and can be deleted.
        await db.$transaction(async (tx) => {
            const deleteStart = performance.now();
            await tx.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    repos: {
                        deleteMany: {}
                    }
                }
            });
            const deleteDuration = performance.now() - deleteStart;
            logger.debug(`Deleted existing repository associations`, {
                connectionId,
                connectionName: connection.name,
                durationMs: deleteDuration,
            });

            const totalUpsertStart = performance.now();
            for (const repo of repoData) {
                const upsertStart = performance.now();
                await tx.repo.upsert({
                    where: {
                        external_id_external_codeHostUrl_orgId: {
                            external_id: repo.external_id,
                            external_codeHostUrl: repo.external_codeHostUrl,
                            orgId: orgId,
                        }
                    },
                    update: repo,
                    create: repo,
                })
                const upsertDuration = performance.now() - upsertStart;
                logger.debug(`Upserted repository ${repo.displayName}`, {
                    connectionId,
                    externalId: repo.external_id,
                    durationMs: upsertDuration,
                });
            }
            const totalUpsertDuration = performance.now() - totalUpsertStart;
            logger.info(`Stored ${repoData.length} repositories`, {
                connectionId,
                connectionName: connection.name,
                repositoryCount: repoData.length,
                durationMs: totalUpsertDuration,
            });
        }, { timeout: env.CONNECTION_MANAGER_UPSERT_TIMEOUT_MS });

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
