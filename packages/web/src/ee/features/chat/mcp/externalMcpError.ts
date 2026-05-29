interface SafeExternalMcpErrorFields {
    errorClass: string;
    errorName?: string;
    oauthError?: string;
    reason?: string;
    statusCode?: number;
}

const OAUTH_ERROR_CODES = new Set([
    'invalid_request',
    'invalid_client',
    'invalid_grant',
    'unauthorized_client',
    'unsupported_grant_type',
    'invalid_scope',
    'server_error',
    'temporarily_unavailable',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function safeIdentifier(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(value)) {
        return undefined;
    }

    return value;
}

function numericStatus(value: unknown): number | undefined {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
        return undefined;
    }

    if (value < 100 || value > 599) {
        return undefined;
    }

    return value;
}

function getStatusCode(error: unknown): number | undefined {
    if (!isRecord(error)) {
        return undefined;
    }

    return numericStatus(error.statusCode)
        ?? numericStatus(error.status)
        ?? (isRecord(error.response) ? numericStatus(error.response.status) : undefined);
}

function safeOAuthErrorCode(value: unknown): string | undefined {
    const identifier = safeIdentifier(value);
    if (!identifier) {
        return undefined;
    }

    const normalized = identifier.toLowerCase();
    return OAUTH_ERROR_CODES.has(normalized) ? normalized : undefined;
}

function getErrorMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return error.message;
    }

    return isRecord(error) && typeof error.message === 'string' ? error.message : undefined;
}

function getConstructorOAuthErrorCode(error: unknown): string | undefined {
    if (!isRecord(error)) {
        return undefined;
    }

    const constructor = error.constructor;
    if (!isRecord(constructor)) {
        return undefined;
    }

    return safeOAuthErrorCode(constructor.errorCode);
}

function getBodyOAuthErrorCode(body: unknown): string | undefined {
    if (typeof body !== 'string' || body.length > 4096) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(body);
        return isRecord(parsed) ? safeOAuthErrorCode(parsed.error) : undefined;
    } catch {
        return undefined;
    }
}

function getMessageOAuthErrorCode(error: unknown): string | undefined {
    const tokens = getErrorMessage(error)?.match(/\b[a-z_]{3,40}\b/g);
    return tokens?.find((token) => OAUTH_ERROR_CODES.has(token));
}

function getOAuthErrorCode(error: unknown): string | undefined {
    if (!isRecord(error)) {
        return undefined;
    }

    return safeOAuthErrorCode(error.error)
        ?? safeOAuthErrorCode(error.code)
        ?? safeOAuthErrorCode(error.errorCode)
        ?? getConstructorOAuthErrorCode(error)
        ?? getBodyOAuthErrorCode(error.body)
        ?? (isRecord(error.response) ? getBodyOAuthErrorCode(error.response.body) : undefined)
        ?? getMessageOAuthErrorCode(error);
}

function getSafeReason(error: unknown): string | undefined {
    const message = getErrorMessage(error)?.toLowerCase();
    if (!message) {
        return undefined;
    }

    if (message.includes('does not support dynamic client registration')) {
        return 'dynamic_client_registration_unsupported';
    }
    if (message.includes('does not support grant type')) {
        return 'unsupported_grant_type';
    }
    if (message.includes('does not support response type')) {
        return 'unsupported_response_type';
    }
    if (message.includes('does not support code challenge method') || message.includes('does not support s256 code challenge')) {
        return 'unsupported_code_challenge_method';
    }
    if (message.includes('oauth state parameter mismatch')) {
        return 'oauth_state_mismatch';
    }
    if (message.includes('oauth client information must be saveable') || message.includes('existing oauth client information is required')) {
        return 'missing_oauth_client_information';
    }

    return undefined;
}

/**
 * Returns log-safe metadata for errors thrown by external MCP/OAuth libraries.
 *
 * Do not log raw error objects, messages, stacks, response bodies, request bodies,
 * or causes from these boundaries. A malicious or misconfigured provider can echo
 * client secrets or tokens into OAuth error bodies.
 */
export function getExternalMcpErrorLogFields(error: unknown): SafeExternalMcpErrorFields {
    const errorClass = error instanceof Error
        ? safeIdentifier(error.constructor.name) ?? 'Error'
        : safeIdentifier(isRecord(error) ? error.constructor?.name : undefined) ?? 'UnknownExternalMcpError';
    const errorName = error instanceof Error
        ? safeIdentifier(error.name)
        : safeIdentifier(isRecord(error) ? error.name : undefined);
    const oauthError = getOAuthErrorCode(error);
    const reason = getSafeReason(error);
    const statusCode = getStatusCode(error);

    return {
        errorClass,
        ...(errorName && errorName !== errorClass ? { errorName } : {}),
        ...(oauthError ? { oauthError } : {}),
        ...(reason ? { reason } : {}),
        ...(statusCode ? { statusCode } : {}),
    };
}
