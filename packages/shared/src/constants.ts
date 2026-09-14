import { CodeHostType } from "@sourcebot/db";
import { ConfigSettings, IdentityProviderType } from "./types.js";

export const SOURCEBOT_SUPPORT_EMAIL = 'support@sourcebot.dev';

/**
 * @deprecated Use API_KEY_PREFIX instead.
 */
export const LEGACY_API_KEY_PREFIX = 'sourcebot-';

export const API_KEY_PREFIX = 'sbk_';
export const OAUTH_ACCESS_TOKEN_PREFIX = 'sboa_';
export const OAUTH_REFRESH_TOKEN_PREFIX = 'sbor_';
export const SCIM_TOKEN_PREFIX = 'sbscim_';
export const SCOPED_ACCESS_TOKEN_PREFIX = 'sbst_';

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
    maxRepoGarbageCollectionJobConcurrency: 2,
    repoGarbageCollectionGracePeriodMs: 10 * 1000, // 10 seconds
    repoIndexTimeoutMs: 1000 * 60 * 60 * 2, // 2 hours
    enablePublicAccess: false, // deprected, use FORCE_ENABLE_ANONYMOUS_ACCESS instead
    repoDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours
    userDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours
    experiment_repoDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours (deprecated)
    experiment_userDrivenPermissionSyncIntervalMs: 1000 * 60 * 60 * 24, // 24 hours (deprecated)
    maxAccountPermissionSyncJobConcurrency: 8,
    maxRepoPermissionSyncJobConcurrency: 8,
}

// Hosts supporting repo-driven sync. Azure DevOps Cloud supports account-driven
// sync only and must not be scheduled on the repo permission queue.
export const PERMISSION_SYNC_SUPPORTED_CODE_HOST_TYPES: CodeHostType[] = [
    'github',
    'gitlab',
    'bitbucketCloud',
    'bitbucketServer',
];

export const PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS = [
    'azuredevops',
    'github',
    'gitlab',
    'bitbucket-cloud',
    'bitbucket-server',
] as const satisfies IdentityProviderType[];

export const doesIdpSupportPermissionSyncing = (providerType: string): providerType is (typeof PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS)[number] =>
    PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS.includes(providerType as (typeof PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS)[number]);

// Request only the Azure DevOps resource, not Microsoft Graph's User.Read.
// The app registration must grant Azure DevOps delegated vso.code permission.
export const AZURE_DEVOPS_OAUTH_SCOPE = 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default';
