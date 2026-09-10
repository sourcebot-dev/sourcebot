'use server';

import { ServiceError, notFound } from "@/lib/serviceError";
import { getBullMQClient } from "@/lib/bullmqClient";
import { withAuth } from "@/middleware/withAuth";
import {
    ACCOUNT_PERMISSION_SYNC_QUEUE,
    type WorkloadJobStatus,
} from "@sourcebot/shared";
import { sew } from "@/middleware/sew";

export interface AccountSyncStatusResponse {
    status: WorkloadJobStatus;
}

export const getAccountSyncStatus = async (jobId: string): Promise<AccountSyncStatusResponse | ServiceError> =>
    sew(() => withAuth(async ({ prisma, user }) => {
        const job = await getBullMQClient().getJob(
            ACCOUNT_PERMISSION_SYNC_QUEUE,
            jobId,
        );
        if (!job) {
            return notFound();
        }

        const account = await prisma.account.findFirst({
            where: {
                id: job.data.accountId,
                userId: user.id,
            },
            select: { id: true },
        });
        if (!account) {
            return notFound();
        }

        return { status: job.status } satisfies AccountSyncStatusResponse;
    }));
