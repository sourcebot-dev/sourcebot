'use server';

import { ServiceError } from "@/lib/serviceError";
import { getBullMQClient } from "@/lib/bullmqClient";
import { withAuth } from "@/middleware/withAuth";
import { getEntitlements } from "@/lib/entitlements";
import {
    ACCOUNT_PERMISSION_SYNC_QUEUE,
    env,
    PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS,
    type WorkloadJob,
    type WorkloadJobStatus,
} from "@sourcebot/shared";
import type { AccountPermissionSyncIssue } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { sew } from "@/middleware/sew";

export interface PermissionSyncStatusResponse {
    hasPendingFirstSync: boolean;
    issues: Array<{
        accountId: string;
        providerId: string;
        providerType: string;
        reason: AccountPermissionSyncIssue;
        occurredAt: string | null;
        isSyncing: boolean;
    }>;
}

const isActiveStatus = (status: WorkloadJobStatus | undefined) =>
    status === "PENDING" || status === "IN_PROGRESS";

/**
 * Returns initial-sync progress and action-required permission sync issues
 * for the authenticated user's linked accounts.
 */
export const getPermissionSyncStatus = async (): Promise<PermissionSyncStatusResponse | ServiceError> => sew(async () =>
    withAuth(async ({ prisma, user }) => {
        const entitlements = await getEntitlements();
        if (!entitlements.includes('permission-syncing')) {
            return {
                statusCode: StatusCodes.FORBIDDEN,
                errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                message: "Permission syncing is not enabled for your license",
            } satisfies ServiceError;
        }


        const accounts = await prisma.account.findMany({
            where: {
                userId: user.id,
                providerType: { in: PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS }
            },
            select: {
                id: true,
                providerId: true,
                providerType: true,
                permissionSyncedAt: true,
                permissionSyncIssue: true,
                permissionSyncIssueAt: true,
                latestPermissionSyncJobId: true,
            }
        });

        const latestJobIds = accounts.flatMap((account) =>
            account.latestPermissionSyncJobId
                ? [account.latestPermissionSyncJobId]
                : [],
        );
        const latestJobs = latestJobIds.length > 0
            ? await getBullMQClient().getJobs(
                  ACCOUNT_PERMISSION_SYNC_QUEUE,
                  latestJobIds,
              )
            : new Map<string, WorkloadJob<"account-permission-sync"> | null>();
        const latestJobsByAccountId = new Map<
            string,
            WorkloadJob<"account-permission-sync"> | null
        >(
            accounts.map((account): [
                string,
                WorkloadJob<"account-permission-sync"> | null,
            ] => {
                const job = account.latestPermissionSyncJobId
                    ? latestJobs.get(account.latestPermissionSyncJobId) ?? null
                    : null;
                return [
                    account.id,
                    job?.data.accountId === account.id ? job : null,
                ];
            }),
        );

        const hasPendingFirstSync = env.PERMISSION_SYNC_ENABLED === 'true' &&
            accounts.some((account) => {
                const latestJob = latestJobsByAccountId.get(account.id);
                return (
                    account.permissionSyncedAt === null
                    // @note: to handle the case where the permission sync job
                    // has not yet been scheduled for a new account, we consider
                    // accounts with no available job as having a pending first sync.
                    && (!latestJob || isActiveStatus(latestJob.status))
                );
            });

        const issues = accounts.flatMap((account) => {
            if (account.permissionSyncIssue === null) {
                return [];
            }

            return [{
                accountId: account.id,
                providerId: account.providerId,
                providerType: account.providerType,
                reason: account.permissionSyncIssue,
                occurredAt: account.permissionSyncIssueAt?.toISOString() ?? null,
                isSyncing: isActiveStatus(
                    latestJobsByAccountId.get(account.id)?.status,
                ),
            }];
        });

        return { hasPendingFirstSync, issues } satisfies PermissionSyncStatusResponse;
    })
)
