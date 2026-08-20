import type { PrismaClient } from "@sourcebot/db";
import {
    ACCOUNT_PERMISSION_SYNC_SCHEDULER_ID_PREFIX,
    getAccountPermissionSyncSchedulerId,
    JOB_PRIORITIES,
} from "@sourcebot/shared";
import type {
    DataOf,
    JobEnqueueOptions,
    QueueName,
    Schedule,
} from "@sourcebot/shared";
import {
    ACCOUNT_PERMISSION_SYNC_WHERE,
    REPO_PERMISSION_SYNC_WHERE,
} from "./ee/permissionSyncEligibility.js";
import { isPermissionSyncEnabled } from "./entitlements.js";
import type { JobManager, Settings } from "./types.js";

interface Props {
    db: PrismaClient;
    jobManager: JobManager;
    settings: Pick<
        Settings,
        | "reindexIntervalMs"
        | "repoDrivenPermissionSyncIntervalMs"
        | "resyncConnectionIntervalMs"
        | "userDrivenPermissionSyncIntervalMs"
    >;
}

/**
 * Reconciles BullMQ's scheduler state with the durable state in the database.
 * This is necessary because database changes and Redis scheduler updates cannot
 * be committed atomically, so crashes or Redis resets can leave schedulers
 * missing or stale. It also queues cleanup for orphaned repositories after
 * removing their obsolete indexing schedulers.
 */
export const reconcileJobSchedulers = async ({
    db,
    jobManager,
    settings,
}: Props): Promise<void> => {
    const permissionSyncEnabled = await isPermissionSyncEnabled();
    const [
        connections,
        repos,
        orphanedReposToCleanup,
        accountsForPermissionSync,
        reposForPermissionSync,
    ] = await Promise.all([
        db.connection.findMany({
            select: {
                id: true,
            },
        }),
        db.repo.findMany({
            where: {
                OR: [
                    {
                        connections: {
                            some: {},
                        },
                    },
                    {
                        isAutoCleanupDisabled: true,
                    },
                ],
            },
            select: {
                id: true,
            },
        }),
        db.repo.findMany({
            where: {
                connections: {
                    none: {},
                },
                isAutoCleanupDisabled: false,
            },
            select: {
                id: true,
            },
        }),
        permissionSyncEnabled
            ? db.account.findMany({
                  where: ACCOUNT_PERMISSION_SYNC_WHERE,
                  select: {
                      id: true,
                  },
              })
            : [],
        permissionSyncEnabled
            ? db.repo.findMany({
                  where: REPO_PERMISSION_SYNC_WHERE,
                  select: {
                      id: true,
                  },
              })
            : [],
    ]);

    await Promise.all([
        reconcileWorkloadSchedulers({
            jobManager,
            workloadName: "connection-sync",
            schedulerIdPrefix: "connection-sync-v1-",
            targets: connections.map(({ id }) => ({
                schedulerId: `connection-sync-v1-${id}`,
                data: { connectionId: id },
            })),
            schedule: settings.resyncConnectionIntervalMs,
            jobOptions: { priority: JOB_PRIORITIES.SCHEDULED },
        }),
        reconcileWorkloadSchedulers({
            jobManager,
            workloadName: "repo-index",
            schedulerIdPrefix: "repo-index-v1-",
            targets: repos.map(({ id }) => ({
                schedulerId: `repo-index-v1-${id}`,
                data: { repoId: id },
            })),
            schedule: settings.reindexIntervalMs,
            jobOptions: { priority: JOB_PRIORITIES.SCHEDULED },
        }),
        reconcileWorkloadSchedulers({
            jobManager,
            workloadName: "account-permission-sync",
            schedulerIdPrefix: ACCOUNT_PERMISSION_SYNC_SCHEDULER_ID_PREFIX,
            targets: accountsForPermissionSync.map(({ id }) => ({
                schedulerId: getAccountPermissionSyncSchedulerId(id),
                data: { accountId: id },
            })),
            schedule: settings.userDrivenPermissionSyncIntervalMs,
            jobOptions: { priority: JOB_PRIORITIES.SCHEDULED },
        }),
        reconcileWorkloadSchedulers({
            jobManager,
            workloadName: "repo-permission-sync",
            schedulerIdPrefix: "repo-permission-sync-v1-",
            targets: reposForPermissionSync.map(({ id }) => ({
                schedulerId: `repo-permission-sync-v1-${id}`,
                data: { repoId: id },
            })),
            schedule: settings.repoDrivenPermissionSyncIntervalMs,
            jobOptions: { priority: JOB_PRIORITIES.SCHEDULED },
        }),
    ]);

    await Promise.all(
        orphanedReposToCleanup.map(({ id }) =>
            jobManager.trigger(
                "repo-cleanup",
                { repoId: id },
                { priority: JOB_PRIORITIES.SCHEDULED },
            ),
        ),
    );
};

interface SchedulerTarget<TName extends QueueName> {
    schedulerId: string;
    data: DataOf<TName>;
}

interface ReconcileOptions<TName extends QueueName> {
    jobManager: JobManager;
    workloadName: TName;
    schedulerIdPrefix: string;
    targets: SchedulerTarget<TName>[];
    schedule: Schedule;
    jobOptions?: JobEnqueueOptions;
}

const reconcileWorkloadSchedulers = async <TName extends QueueName>({
    jobManager,
    workloadName,
    schedulerIdPrefix,
    targets,
    schedule,
    jobOptions,
}: ReconcileOptions<TName>): Promise<void> => {
    const existingSchedulerIds = new Set(
        await jobManager.getJobSchedulerIds(workloadName),
    );
    const desiredSchedulerIds = new Set(
        targets.map(({ schedulerId }) => schedulerId),
    );

    await Promise.all(
        targets.map(({ schedulerId, data }) => {
            if (jobOptions) {
                return jobManager.upsertJobScheduler(
                    workloadName,
                    schedulerId,
                    schedule,
                    data,
                    jobOptions,
                );
            }
            return jobManager.upsertJobScheduler(
                workloadName,
                schedulerId,
                schedule,
                data,
            );
        }),
    );

    const obsoleteSchedulerIds = [...existingSchedulerIds].filter(
        (schedulerId) =>
            schedulerId.startsWith(schedulerIdPrefix) &&
            !desiredSchedulerIds.has(schedulerId),
    );
    await Promise.all(
        obsoleteSchedulerIds.map((schedulerId) =>
            jobManager.removeJobScheduler(workloadName, schedulerId),
        ),
    );
};
