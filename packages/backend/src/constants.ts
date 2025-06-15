import { Settings } from "./types.js";

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    maxTrigramCount: 20000,
    reindexIntervalMs: 1000 * 60 * 60, // 1 hour
    resyncConnectionIntervalMs: 1000 * 60 * 60 * 24, // 24 hours
    resyncConnectionPollingIntervalMs: 1000 * 1, // 1 second
    reindexRepoPollingIntervalMs: 1000 * 1, // 1 second
    maxConnectionSyncJobConcurrency: 8,
    maxRepoIndexingJobConcurrency: 8,
    maxRepoGarbageCollectionJobConcurrency: 8,
    repoGarbageCollectionGracePeriodMs: 10 * 1000, // 10 seconds
    repoIndexTimeoutMs: 1000 * 60 * 60 * 2, // 2 hours
    enablePublicAccess: false,
}

// NOTE: changing SOURCEBOT_GUEST_USER_ID may break backwards compatibility since this value is used
// to detect old guest users in the DB. If you change this value ensure it doesn't break upgrade flows
export const SOURCEBOT_GUEST_USER_ID = '1';
export const SOURCEBOT_GUEST_USER_EMAIL = 'guest@sourcebot.dev';
export const SINGLE_TENANT_ORG_ID = 1;
export const SINGLE_TENANT_ORG_DOMAIN = '~';
export const SINGLE_TENANT_ORG_NAME = 'default';