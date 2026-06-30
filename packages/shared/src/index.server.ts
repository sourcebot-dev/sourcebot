// types prefixed with _ are intended to be wrapped
// by the consumer. See web/entitlements.ts and
// backend/entitlements.ts
export {
    hasEntitlement as _hasEntitlement,
    getEntitlements as _getEntitlements,
    isAnonymousAccessAvailable as _isAnonymousAccessAvailable,
    isValidLicenseActive as _isValidLicenseActive,
    isValidOfflineLicenseActive,
    isValidOnlineLicenseActive as _isValidOnlineLicenseActive,
    getSeatCap,
    getOfflineLicenseMetadata,
    STALE_ONLINE_LICENSE_THRESHOLD_MS,
    STALE_ONLINE_LICENSE_WARNING_THRESHOLD_MS,
} from "./entitlements.js";
export type {
    Entitlement,
    OfflineLicenseMetadata,
} from "./entitlements.js";
export type {
    RepoMetadata,
    RepoIndexingJobMetadata,
    IdentityProviderType,
    LicenseStatus,
} from "./types.js";
export {
    repoMetadataSchema,
    repoIndexingJobMetadataSchema,
} from "./types.js";
export {
    base64Decode,
    loadJsonFile,
    getConfigSettings,
    getRepoPath,
    getRepoIdFromPath,
    isCredentialsLoginEnabled,
    isEmailCodeLoginEnabled,
    isMemberApprovalRequired,
} from "./utils.js";
export * from "./constants.js";
export {
    resolveEnvironmentVariableOverridesFromConfig,
    loadConfig,
    getIdentityProviderConfigs,
    getIdentityProviderConfig,
    isRemotePath,
} from "./env.server.js";
export { env } from "./env.server.js"
export {
    createLogger,
} from "./logger.js";
export type {
    Logger,
} from "./logger.js";
export {
    getTokenFromConfig,
    encrypt,
    decrypt,
    hashSecret,
    generateApiKey,
    generateOAuthToken,
    generateOAuthRefreshToken,
    verifySignature,
    encryptOAuthToken,
    decryptOAuthToken,
    encryptActivationCode,
    decryptActivationCode,
} from "./crypto.js";
export {
    getDBConnectionString,
} from "./db.js";
export {
    getSMTPConnectionURL,
} from "./smtp.js";
export {
    createRedisClient,
} from "./redis.js";
export {
    getStorageBackend,
    LocalFsStorageBackend,
} from "./storage.js";
export type {
    StorageBackend,
} from "./storage.js";
export {
    SOURCEBOT_VERSION,
} from "./version.js";
export {
    parseVersion,
    formatVersion,
    compareVersions,
} from "./versionUtils.js";
export type { Version } from "./versionUtils.js";
