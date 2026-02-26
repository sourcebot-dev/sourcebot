'use server';

import { apiHandler } from "@/lib/apiHandler";
import { ServiceError, serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import { env, getEntitlements } from "@sourcebot/shared";
import { AccountPermissionSyncJobStatus } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { sew } from "@/actions";

export interface PermissionSyncStatusResponse {
    hasPendingFirstSync: boolean;
}

/**
 * Returns whether a user has a account that has it's permissions
 * synced for the first time.
 */
export const GET = apiHandler(async () => {
    const result = await getPermissionSyncStatus();

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});


export const getPermissionSyncStatus = async (): Promise<PermissionSyncStatusResponse | ServiceError> => sew(async () =>
    withAuthV2(async ({ prisma, user }) => {
        const entitlements = getEntitlements();
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
                provider: { in: ['github', 'gitlab', 'bitbucket-cloud', 'bitbucket-server'] }
            },
            include: {
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

        const hasPendingFirstSync = env.EXPERIMENT_EE_PERMISSION_SYNC_ENABLED === 'true' &&
            accounts.some(account =>
                account.permissionSyncedAt === null &&
                // @note: to handle the case where the permission sync job
                // has not yet been scheduled for a new account, we consider
                // accounts with no permission sync jobs as having a pending first sync.
                (account.permissionSyncJobs.length === 0 || (account.permissionSyncJobs.length > 0 && activeStatuses.includes(account.permissionSyncJobs[0].status)))
            )

        return { hasPendingFirstSync } satisfies PermissionSyncStatusResponse;
    })
)
