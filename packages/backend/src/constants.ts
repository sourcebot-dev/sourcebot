import { Settings } from "./types.js";

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    reindexIntervalMs: 1000 * 60 * 60, // 1 hour
    resyncConnectionPollingIntervalMs: 1000,
    reindexRepoPollingIntervalMs: 1000,
    indexConcurrencyMultiple: 3,
    configSyncConcurrencyMultiple: 3,
    gcConcurrencyMultiple: 1,
    gcGracePeriodMs: 10 * 1000, // 10 seconds
    repoIndexTimeoutMs: 1000 * 60 * 60 * 2, // 2 hours
    maxTrigramCount: 20000,
}