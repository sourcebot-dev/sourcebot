import 'server-only';

import { getBullMQClient } from '@/lib/bullmqClient';
import {
    ACCOUNT_PERMISSION_SYNC_QUEUE,
    env,
    getAccountPermissionSyncSchedulerId,
    getConfigSettings,
    JOB_PRIORITIES,
} from '@sourcebot/shared';

export const scheduleAndTriggerAccountPermissionSync = async (
    accountId: string,
): Promise<{ jobId: string }> => {
    const settings = await getConfigSettings(env.CONFIG_PATH);
    const client = getBullMQClient();
    const data = { accountId };

    await client.upsertJobScheduler(
        ACCOUNT_PERMISSION_SYNC_QUEUE,
        getAccountPermissionSyncSchedulerId(accountId),
        settings.userDrivenPermissionSyncIntervalMs,
        data,
        { priority: JOB_PRIORITIES.SCHEDULED },
    );
    const jobId = await client.enqueue(
        ACCOUNT_PERMISSION_SYNC_QUEUE,
        data,
        { priority: JOB_PRIORITIES.INTERACTIVE },
    );

    return { jobId };
};

export const removeAccountPermissionSyncScheduler = (
    accountId: string,
): Promise<boolean> =>
    getBullMQClient().removeJobScheduler(
        ACCOUNT_PERMISSION_SYNC_QUEUE,
        getAccountPermissionSyncSchedulerId(accountId),
    );
