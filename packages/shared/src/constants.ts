import { CodeHostType } from "@sourcebot/db";
import { ConfigSettings, IdentityProviderType } from "./types.js";

export const SOURCEBOT_SUPPORT_EMAIL = 'team@sourcebot.dev';

/**
 * @deprecated Use API_KEY_PREFIX instead.
 */
export const LEGACY_API_KEY_PREFIX = 'sourcebot-';

export const API_KEY_PREFIX = 'sbk_';
export const OAUTH_ACCESS_TOKEN_PREFIX = 'sboa_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'sbor_';

export const SOURCEBOT_UNLIMITED_SEATS = -1;

/**
 * Default settings.
 */
export const DEFAULT_CONFIG_SETTINGS: ConfigSettings = {
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
    enablePublicAccess: false, // deprected, use FORCE_ENABLE_ANONYMOUS_ACCESS instead
    experiment_repoDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours
    experiment_userDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours
    maxAccountPermissionSyncJobConcurrency: 8,
    maxRepoPermissionSyncJobConcurrency: 8,
}

export const PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES: CodeHostType[] = [
    'github',
    'gitlab',
    'bitbucketCloud',
    'bitbucketServer',
];

export const PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS: IdentityProviderType[] = [
    'github',
    'gitlab',
    'bitbucket-cloud',
    'bitbucket-server',
];