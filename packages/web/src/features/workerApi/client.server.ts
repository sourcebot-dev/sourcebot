import 'server-only';

import { env } from '@sourcebot/shared';
import { z } from 'zod';

const accountPermissionSyncResponseSchema = z.object({
    jobId: z.string(),
});
const WORKER_REQUEST_TIMEOUT_MS = 5000;

export const requestAccountPermissionSync = async (accountId: string): Promise<{ jobId: string }> => {
    const response = await fetch(`${env.WORKER_API_URL}/api/trigger-account-permission-sync`, {
        method: 'POST',
        body: JSON.stringify({ accountId }),
        headers: {
            'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(WORKER_REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Worker rejected account permission sync with HTTP ${response.status}.`);
    }

    return accountPermissionSyncResponseSchema.parse(await response.json());
};
