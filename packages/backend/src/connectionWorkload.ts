import * as Sentry from "@sentry/node";
import { ConnectionSyncJobStatus, PrismaClient } from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/index.type";
import {
    CONNECTION_QUEUE,
    createLogger,
    env,
    JOB_PRIORITIES,
    loadConfig,
} from "@sourcebot/shared";
import { REPO_PERMISSION_SYNC_WHERE } from "./ee/permissionSyncEligibility.js";
import { isPermissionSyncEnabled } from "./entitlements.js";
import { syncSearchContexts } from "./ee/syncSearchContexts.js";
import {
    compileAzureDevOpsConfig,
    compileBitbucketConfig,
    compileGenericGitHostConfig,
    compileGerritConfig,
    compileGiteaConfig,
    compileGithubConfig,
    compileGitlabConfig,
} from "./repoCompileUtils.js";
import type { RepoData } from "./repoCompileUtils.js";
import { JobManager, ProcessContext, Settings, Workload } from "./types.js";

const CONNECTION_SYNC_LOCK_DURATION_MS = 60_000;
const logger = createLogger("connection-workload");

interface Props {
    db: PrismaClient;
    jobManager: JobManager;
    settings: Settings;
}

interface ConnectionSyncResult {
    reposToCleanup: { id: number; name: string }[];
    reposToIndex: { id: number; name: string }[];
}

export const createConnectionWorkload = ({
    db,
    jobManager,
    settings,
}: Props): Workload<"connection-sync", ConnectionSyncResult> => ({
    queueSpec: CONNECTION_QUEUE,
    concurrency: settings.maxConnectionSyncJobConcurrency,
    executionLock: {
        resource: ({ connectionId }) =>
            `sourcebot:lock:connection:${connectionId}`,
        durationMs: CONNECTION_SYNC_LOCK_DURATION_MS,
    },
    process: async ({
        data: { connectionId },
        signal,
        jobId,
        trigger,
    }) => {
        signal.throwIfAborted();
        const connection = await db.connection.findUniqueOrThrow({
            where: {
                id: connectionId,
            },
        });
        signal.throwIfAborted();
        const { orgId } = connection;

        logger.debug(`Syncing connection ${connectionId}`, {
            connectionId,
            orgId,
        });

        const { repoData, warnings } = await discoverConnectionRepositories({
            config: connection.config as unknown as ConnectionConfig,
            connectionId,
            signal,
        });

        signal.throwIfAborted();
        await db.connectionSyncJob.update({
            where: {
                id: jobId,
            },
            data: {
                warningMessages: warnings,
            },
        });

        logger.debug(`Discovered ${repoData.length} repositories`, {
            connectionId,
            repositoryCount: repoData.length,
        });

        signal.throwIfAborted();
        const repoChanges = await replaceConnectionRepositories({
            db,
            connectionId,
            orgId,
            discoveredRepos: repoData,
        });

        signal.throwIfAborted();
        await reconcileRepoIndexWork({
            jobManager,
            trigger,
            currentRepos: repoChanges.currentRepos,
            unindexedRepos: repoChanges.unindexedRepos,
            orphanedRepos: repoChanges.orphanedRepos,
            intervalMs: settings.reindexIntervalMs,
        });

        signal.throwIfAborted();
        await reconcileRepoPermissionSyncWork({
            db,
            jobManager,
            trigger,
            affectedRepoIds: repoChanges.affectedRepoIds,
            intervalMs: settings.repoDrivenPermissionSyncIntervalMs,
        });

        logger.debug(
            `Stored ${repoChanges.currentRepos.length} repositories`,
            {
                connectionId,
                connectionName: connection.name,
                repositoryCount: repoChanges.currentRepos.length,
            },
        );

        signal.throwIfAborted();
        await db.connection.update({
            where: {
                id: connectionId,
            },
            data: {
                syncedAt: new Date(),
            },
        });

        // After a connection has synced, we need to re-sync the org's search contexts as
        // there may be new repos that match the search context's include/exclude patterns.
        signal.throwIfAborted();
        try {
            const config = await loadConfig(env.CONFIG_PATH);

            await syncSearchContexts({
                orgId,
                contexts: config.contexts,
            });
        } catch (error) {
            logger.error(
                `Failed to sync search contexts for connection ${connectionId}`,
                error,
            );
            Sentry.captureException(error);
        }
        signal.throwIfAborted();

        logger.debug(`Connection ${connectionId} sync finished`, {
            connectionId,
        });

        return {
            reposToCleanup: repoChanges.orphanedRepos,
            reposToIndex: repoChanges.unindexedRepos,
        };
    },
    onStarted: async ({ data: { connectionId }, jobId }) => {
        await db.$transaction(async (tx) => {
            await tx.connectionSyncJob.upsert({
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
            await tx.connection.update({
                where: {
                    id: connectionId,
                },
                data: {
                    latestSyncJobId: jobId,
                },
            });
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

export interface CurrentRepo {
    id: number;
    name: string;
    indexedAt: Date | null;
}

export interface ConnectionRepoChanges {
    currentRepos: CurrentRepo[];
    unindexedRepos: { id: number; name: string }[];
    orphanedRepos: { id: number; name: string }[];
    affectedRepoIds: number[];
}

type Trigger = ProcessContext<"connection-sync">["trigger"];

const deduplicateRepos = (repos: RepoData[]): RepoData[] =>
    repos.filter(
        (repo, index, allRepos) =>
            index ===
            allRepos.findIndex(
                (candidate) =>
                    candidate.external_id === repo.external_id &&
                    candidate.external_codeHostUrl ===
                        repo.external_codeHostUrl,
            ),
    );

export const replaceConnectionRepositories = async ({
    db,
    connectionId,
    orgId,
    discoveredRepos,
}: {
    db: PrismaClient;
    connectionId: number;
    orgId: number;
    discoveredRepos: RepoData[];
}): Promise<ConnectionRepoChanges> => {
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

    const currentRepos: CurrentRepo[] = [];
    for (const repo of deduplicateRepos(discoveredRepos)) {
        currentRepos.push(
            await db.repo.upsert({
                where: {
                    external_id_external_codeHostUrl_orgId: {
                        external_id: repo.external_id,
                        external_codeHostUrl: repo.external_codeHostUrl,
                        orgId,
                    },
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
            }),
        );
    }

    const currentRepoIds = new Set(currentRepos.map(({ id }) => id));
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

    const orphanedRepos =
        staleRepoIds.length > 0
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

    return {
        currentRepos,
        unindexedRepos: currentRepos
            .filter(({ indexedAt }) => indexedAt === null)
            .map(({ id, name }) => ({ id, name })),
        orphanedRepos,
        affectedRepoIds: [...new Set([...currentRepoIds, ...staleRepoIds])],
    };
};

export const reconcileRepoIndexWork = async ({
    jobManager,
    trigger,
    currentRepos,
    unindexedRepos,
    orphanedRepos,
    intervalMs,
}: {
    jobManager: JobManager;
    trigger: Trigger;
    currentRepos: CurrentRepo[];
    unindexedRepos: { id: number; name: string }[];
    orphanedRepos: { id: number; name: string }[];
    intervalMs: number;
}): Promise<void> => {
    await Promise.all(
        currentRepos.map(({ id }) =>
            jobManager.upsertJobScheduler(
                "repo-index",
                `repo-index-v1-${id}`,
                intervalMs,
                { repoId: id, type: "INDEX" },
                { priority: JOB_PRIORITIES.SCHEDULED },
            ),
        ),
    );

    await Promise.all(
        orphanedRepos.map(({ id }) =>
            jobManager.removeJobScheduler(
                "repo-index",
                `repo-index-v1-${id}`,
            ),
        ),
    );

    await Promise.all(
        orphanedRepos.map(({ id }) =>
            trigger(
                "repo-index",
                {
                    repoId: id,
                    type: "CLEANUP",
                },
                { priority: JOB_PRIORITIES.SCHEDULED },
            ),
        ),
    );

    await Promise.all(
        unindexedRepos.map(({ id }) =>
            trigger(
                "repo-index",
                {
                    repoId: id,
                    type: "INDEX",
                },
                { priority: JOB_PRIORITIES.INITIAL },
            ),
        ),
    );
};

export const reconcileRepoPermissionSyncWork = async ({
    db,
    jobManager,
    trigger,
    affectedRepoIds,
    intervalMs,
}: {
    db: PrismaClient;
    jobManager: JobManager;
    trigger: Trigger;
    affectedRepoIds: number[];
    intervalMs: number;
}): Promise<void> => {
    const permissionSyncEnabled =
        affectedRepoIds.length > 0 && (await isPermissionSyncEnabled());
    const [eligibleRepos, existingSchedulerIds] =
        permissionSyncEnabled
            ? await Promise.all([
                  db.repo.findMany({
                      where: {
                          id: {
                              in: affectedRepoIds,
                          },
                          ...REPO_PERMISSION_SYNC_WHERE,
                      },
                      select: {
                          id: true,
                          permissionSyncedAt: true,
                      },
                  }),
                  jobManager.getJobSchedulerIds("repo-permission-sync"),
              ])
            : [[], []];
    const existingSchedulerIdSet = new Set(existingSchedulerIds);
    const eligibleRepoIds = new Set(eligibleRepos.map(({ id }) => id));
    const ineligibleRepoIds = affectedRepoIds.filter(
        (id) => !eligibleRepoIds.has(id),
    );

    await Promise.all(
        eligibleRepos.map(({ id }) =>
            jobManager.upsertJobScheduler(
                "repo-permission-sync",
                `repo-permission-sync-v1-${id}`,
                intervalMs,
                { repoId: id },
                { priority: JOB_PRIORITIES.SCHEDULED },
            ),
        ),
    );

    await Promise.all(
        ineligibleRepoIds.map((id) =>
            jobManager.removeJobScheduler(
                "repo-permission-sync",
                `repo-permission-sync-v1-${id}`,
            ),
        ),
    );

    await Promise.all(
        eligibleRepos
            .filter(
                ({ id, permissionSyncedAt }) =>
                    permissionSyncedAt === null ||
                    !existingSchedulerIdSet.has(
                        `repo-permission-sync-v1-${id}`,
                    ),
            )
            .map(({ id }) =>
                trigger(
                    "repo-permission-sync",
                    { repoId: id },
                    { priority: JOB_PRIORITIES.SCHEDULED },
                ),
            ),
    );
};

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
        case "github": {
            return compileGithubConfig(config, connectionId, signal);
        }
        case "gitlab": {
            return compileGitlabConfig(config, connectionId);
        }
        case "gitea": {
            return compileGiteaConfig(config, connectionId);
        }
        case "gerrit": {
            return compileGerritConfig(config, connectionId);
        }
        case "bitbucket": {
            return compileBitbucketConfig(config, connectionId);
        }
        case "azuredevops": {
            return compileAzureDevOpsConfig(config, connectionId);
        }
        case "git": {
            return compileGenericGitHostConfig(config, connectionId);
        }
    }
};
