import type { IdentityProviderType } from '@sourcebot/shared';
import { getErrorHeader, getErrorStatus } from '../errors.js';

export type PermissionSyncUpstreamErrorKind =
    | 'credential_rejected'
    | 'insufficient_scope'
    | 'rate_limited'
    | 'upstream_unavailable'
    | 'forbidden'
    | 'unknown';

export type PermissionSyncOperation =
    | 'inspect_token_scopes'
    | 'list_accessible_repositories';

type PermissionSyncUpstreamErrorOptions = {
    kind: PermissionSyncUpstreamErrorKind;
    provider: IdentityProviderType;
    operation: PermissionSyncOperation;
    status?: number;
    cause?: unknown;
};

export class PermissionSyncUpstreamError extends Error {
    public readonly kind: PermissionSyncUpstreamErrorKind;
    public readonly provider: IdentityProviderType;
    public readonly operation: PermissionSyncOperation;
    public readonly status?: number;

    constructor(message: string, options: PermissionSyncUpstreamErrorOptions) {
        super(message, { cause: options.cause });
        this.name = 'PermissionSyncUpstreamError';
        this.kind = options.kind;
        this.provider = options.provider;
        this.operation = options.operation;
        this.status = options.status;
    }
}

const isRateLimited = (error: unknown, status: number | null): boolean =>
    status === 429 ||
    getErrorHeader(error, 'retry-after') !== undefined ||
    getErrorHeader(error, 'x-ratelimit-remaining') === '0';

const isNetworkOrTimeoutError = (error: unknown): boolean => {
    if (!(error instanceof Error)) {
        return false;
    }

    return error instanceof TypeError || error.name === 'AbortError' || error.name === 'TimeoutError';
};

export const classifyPermissionSyncUpstreamError = (
    error: unknown,
    provider: IdentityProviderType,
    operation: PermissionSyncOperation,
): PermissionSyncUpstreamError => {
    if (error instanceof PermissionSyncUpstreamError) {
        return error;
    }

    const status = getErrorStatus(error);

    if (status === 401) {
        return new PermissionSyncUpstreamError(
            `${provider} rejected the permission sync credential.`,
            { kind: 'credential_rejected', provider, operation, status, cause: error },
        );
    }

    if (isRateLimited(error, status)) {
        return new PermissionSyncUpstreamError(
            `${provider} rate limited the permission sync request.`,
            { kind: 'rate_limited', provider, operation, status: status ?? undefined, cause: error },
        );
    }

    if (status === 403) {
        return new PermissionSyncUpstreamError(
            `${provider} forbade the permission sync request.`,
            { kind: 'forbidden', provider, operation, status, cause: error },
        );
    }

    if (
        status === 408 ||
        (status !== null && status >= 500 && status < 600) ||
        isNetworkOrTimeoutError(error)
    ) {
        return new PermissionSyncUpstreamError(
            `${provider} is temporarily unavailable for permission syncing.`,
            { kind: 'upstream_unavailable', provider, operation, status: status ?? undefined, cause: error },
        );
    }

    return new PermissionSyncUpstreamError(
        `${provider} permission sync failed with an unclassified upstream error.`,
        { kind: 'unknown', provider, operation, status: status ?? undefined, cause: error },
    );
};

export const withPermissionSyncUpstreamError = async <T>(
    provider: IdentityProviderType,
    operation: PermissionSyncOperation,
    callback: () => Promise<T>,
): Promise<T> => {
    try {
        return await callback();
    } catch (error) {
        throw classifyPermissionSyncUpstreamError(error, provider, operation);
    }
};
