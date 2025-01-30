import { Settings } from "./types.js";

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: Settings = {
    maxFileSize: 2 * 1024 * 1024, // 2MB in bytes
    maxTrigramCount: 20000,
    autoDeleteStaleRepos: true,
    reindexInterval: 1000 * 60 * 60, // 1 hour in milliseconds
    resyncInterval: 1000 * 60 * 60 * 24, // 1 day in milliseconds
}