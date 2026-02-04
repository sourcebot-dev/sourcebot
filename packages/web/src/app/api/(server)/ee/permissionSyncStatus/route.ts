'use server';

import { apiHandler } from "@/lib/apiHandler";
import { serviceErrorResponse } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuthV2 } from "@/withAuthV2";
import { getEntitlements } from "@sourcebot/shared";
import { AccountPermissionSyncJobStatus } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";

export interface PermissionSyncStatusResponse {
    hasPendingFirstSync: boolean;
}

/**
 * Returns whether a user has a account that has it's permissions
 * synced for the first time.
 */
export const GET = apiHandler(async () => {
    const entitlements = getEntitlements();
    if (!entitlements.includes('permission-syncing')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Permission syncing is not enabled for your license",
        });
    }

    const result = await withAuthV2(async ({ prisma, user }) => {
        const accounts = await prisma.account.findMany({
            where: {
                userId: user.id,
                provider: { in: ['github', 'gitlab'] }
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

        const hasPendingFirstSync = accounts.some(account =>
            account.permissionSyncedAt === null &&
            account.permissionSyncJobs.length > 0 &&
            activeStatuses.includes(account.permissionSyncJobs[0].status)
        );

        return { hasPendingFirstSync } satisfies PermissionSyncStatusResponse;
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});
