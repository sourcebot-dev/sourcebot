import { Settings } from "./types.js";

/**
 * The interval to reindex a given repository.
 */
export const REINDEX_INTERVAL_MS = 1000 * 60 * 60;

/**
 * The interval to re-sync the config.
 */
export const RESYNC_CONFIG_INTERVAL_MS = 1000 * 60 * 60 * 24;

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    autoDeleteStaleRepos: true,
}