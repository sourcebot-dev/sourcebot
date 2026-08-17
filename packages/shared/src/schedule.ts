export type Schedule = string | number;

export const ACCOUNT_PERMISSION_SYNC_SCHEDULER_ID_PREFIX =
    "account-permission-sync-v1-";

export const getAccountPermissionSyncSchedulerId = (
    accountId: string,
): string => `${ACCOUNT_PERMISSION_SYNC_SCHEDULER_ID_PREFIX}${accountId}`;

const SCHEDULE_UNITS_MS: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 1000 * 60,
    h: 1000 * 60 * 60,
    d: 1000 * 60 * 60 * 24,
};

export const scheduleToMs = (schedule: Schedule): number => {
    if (typeof schedule === "number") {
        if (!Number.isFinite(schedule) || schedule <= 0) {
            throw new Error(
                `Invalid schedule "${schedule}". Expected a positive number of milliseconds.`,
            );
        }
        return schedule;
    }

    const match = /^(\d+)(ms|s|m|h|d)$/.exec(schedule.trim());
    if (!match) {
        throw new Error(
            `Invalid schedule "${schedule}". Expected e.g. "500ms", "30s", "5m", "6h", or "1d".`,
        );
    }

    const intervalMs = Number(match[1]) * SCHEDULE_UNITS_MS[match[2]];
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
        throw new Error(
            `Invalid schedule "${schedule}". Expected a positive finite interval.`,
        );
    }

    return intervalMs;
};
