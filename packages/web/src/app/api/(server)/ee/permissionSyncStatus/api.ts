'use server';

import { ServiceError } from "@/lib/serviceError";
import { withAuth } from "@/middleware/withAuth";
import { getEntitlements } from "@/lib/entitlements";
import { env, PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS } from "@sourcebot/shared";
import { AccountPermissionSyncJobStatus, type AccountPermissionSyncIssue } from "@sourcebot/db";
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
                permissionSyncJobs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                }
            }
        });

        const activeStatuses: AccountPermissionSyncJobStatus[] = [
            AccountPermissionSyncJobStatus.PENDING,
            AccountPermissionSyncJobStatus.IN_PROGRESS
        ];

        const hasPendingFirstSync = env.PERMISSION_SYNC_ENABLED === 'true' &&
            accounts.some(account =>
                account.permissionSyncedAt === null &&
                // @note: to handle the case where the permission sync job
                // has not yet been scheduled for a new account, we consider
                // accounts with no permission sync jobs as having a pending first sync.
                (account.permissionSyncJobs.length === 0 || (account.permissionSyncJobs.length > 0 && activeStatuses.includes(account.permissionSyncJobs[0].status)))
            );

        const issues = accounts.flatMap(account => account.permissionSyncIssue === null ? [] : [{
            accountId: account.id,
            providerId: account.providerId,
            providerType: account.providerType,
            reason: account.permissionSyncIssue,
            occurredAt: account.permissionSyncIssueAt?.toISOString() ?? null,
            isSyncing: account.permissionSyncJobs.some(job => activeStatuses.includes(job.status)),
        }]);

        return { hasPendingFirstSync, issues } satisfies PermissionSyncStatusResponse;
    })
)
