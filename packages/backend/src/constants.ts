import { Settings } from "./types.js";

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    maxTrigramCount: 20000,
    reindexIntervalMs: 1000 * 60 * 60, // 1 hour
    resyncConnectionPollingIntervalMs: 1000 * 1, // 1 second
    reindexRepoPollingIntervalMs: 1000 * 1, // 1 second
    maxConnectionSyncJobConcurrency: 8,
    maxRepoIndexingJobConcurrency: 8,
    maxRepoGarbageCollectionJobConcurrency: 8,
    repoGarbageCollectionGracePeriodMs: 10 * 1000, // 10 seconds
    repoIndexTimeoutMs: 1000 * 60 * 60 * 2, // 2 hours
}