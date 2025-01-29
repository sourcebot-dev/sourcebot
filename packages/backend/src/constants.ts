import { Settings } from "./types.js";

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    autoDeleteStaleRepos: true,
    reindexIntervalMs: 1000 * 60,
    resyncConnectionPollingIntervalMs: 1000,
    reindexRepoPollingInternvalMs: 1000,
    indexConcurrencyMultiple: 3,
    configSyncConcurrencyMultiple: 3,
}