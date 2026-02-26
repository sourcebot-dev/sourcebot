'use server';

import { ServiceError, notFound } from "@/lib/serviceError";
import { withAuthV2 } from "@/withAuthV2";
import { AccountPermissionSyncJobStatus } from "@sourcebot/db";
import { sew } from "@/actions";

export interface AccountSyncStatusResponse {
    isSyncing: boolean;
}

export const getAccountSyncStatus = async (jobId: string): Promise<AccountSyncStatusResponse | ServiceError> =>
    sew(() => withAuthV2(async ({ prisma, user }) => {
        const job = await prisma.accountPermissionSyncJob.findFirst({
            where: {
                id: jobId,
                account: { userId: user.id },
            },
        });

        if (!job) return notFound();

        const activeStatuses: AccountPermissionSyncJobStatus[] = [
            AccountPermissionSyncJobStatus.PENDING,
            AccountPermissionSyncJobStatus.IN_PROGRESS,
        ];

        const isSyncing = activeStatuses.includes(job.status);

        return { isSyncing } satisfies AccountSyncStatusResponse;
    }));
