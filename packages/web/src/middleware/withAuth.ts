import { __unsafePrisma, userScopedPrismaClientExtension } from "@/prisma";
import { hashSecret, OAUTH_ACCESS_TOKEN_PREFIX, API_KEY_PREFIX, LEGACY_API_KEY_PREFIX, SCOPED_ACCESS_TOKEN_PREFIX, env } from "@sourcebot/shared";
import { ApiKey, Org, OrgRole, PrismaClient, UserToOrg, UserType, UserWithAccounts } from "@sourcebot/db";
import { headers } from "next/headers";
import { auth } from "../auth";
import { insufficientOAuthScope, notAuthenticated, notFound, ServiceError } from "../lib/serviceError";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "../lib/errorCodes";
import { isServiceError } from "../lib/utils";
import { hasEntitlement, isAnonymousAccessEnabled } from "@/lib/entitlements";
import { activatePendingMembership } from "@/features/membership/membership.service";
import { hasRequiredOAuthScopes, parseOAuthScopeString } from "@/ee/features/oauth/utils";
import { DPOP_AUTH_SCHEME, DPOP_PROOF_HEADER, verifyDpopProof } from "@/ee/features/oauth/dpop";
import { getCurrentRequest } from "@/lib/requestContext";
import { setSentryUser } from "@/lib/sentryUser";

const LAST_ACTIVE_AT_THRESHOLD_MS = 5 * 60 * 1000;

type RequiredAuthContext = {
    user: UserWithAccounts;
    role: OrgRole;
    org: Org;
    prisma: PrismaClient;
    principal: AuthPrincipal;
};

type OptionalAuthContext =
    | RequiredAuthContext
    | {
        user?: UserWithAccounts;
        role?: undefined;
        org: Org;
        prisma: PrismaClient;
        principal?: AuthPrincipal;
    };

export type AuthPrincipal =
    | { source: 'session' }
    | { source: 'oauth'; oauthScopes: string[] }
    | { source: 'api_key' }
    | {
        source: 'scoped_access_token';
        credentialId: string;
        orgId: number;
        repositoryIds: number[];
        expiresAt: Date;
    };

export type AuthSource = AuthPrincipal['source'];

export type AuthResult = {
    user: UserWithAccounts;
    principal: AuthPrincipal;
};

type AuthOptions = {
    requiredOAuthScopes?: readonly string[];
    requiredAuthSource?: AuthSource;
};

export const withAuth = async <T>(fn: (params: RequiredAuthContext) => Promise<T>, options: AuthOptions = {}) => {
    const authContext = await getAuthContext(options);

    if (isServiceError(authContext)) {
        return authContext;
    }

    const { user, org, role, prisma, principal } = authContext;

    if (!user || !role || !principal) {
        return notAuthenticated();
    }

    return fn({ user, org, role, prisma, principal });
};

export const withOptionalAuth = async <T>(fn: (params: OptionalAuthContext) => Promise<T>, options: AuthOptions = {}) => {
    const authContext = await getAuthContext(options);
    if (isServiceError(authContext)) {
        return authContext;
    }

    if (
        (!authContext.user || !authContext.role) &&
        !(await isAnonymousAccessEnabled())
    ) {
        return notAuthenticated();
    }

    return fn(authContext);
};

export const getAuthContext = async (options: AuthOptions = {}): Promise<OptionalAuthContext | ServiceError> => {
    const authResult = await getAuthenticatedUser();
    const user = authResult?.user;

    setSentryUser(
        user ?? null,
        env.SOURCEBOT_TELEMETRY_PII_COLLECTION_ENABLED === 'true',
    );

    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        }
    });

    if (!org) {
        return notFound("Organization not found");
    }

    if (
        authResult?.principal.source === 'scoped_access_token' &&
        authResult.principal.orgId !== org.id
    ) {
        return notAuthenticated();
    }

    const membership = user ? await __unsafePrisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: user.id,
            },
        },
    }) : null;

    // A suspended membership is treated as if the user is not a member: they get
    // no role and are denied by `withAuth`. This is also the only gate for
    // API-key auth, which bypasses the JWT `sessionVersion` logout check.
    const role = (membership && membership.suspendedAt == null) ? membership.role : undefined;

    // Applies uniformly to human and service-account API keys: a service
    // account's OrgRole (via its own UserToOrg row) gates its key exactly
    // like a human member's role gates theirs.
    if (
        env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true' &&
        authResult?.principal.source === 'api_key' &&
        role !== OrgRole.OWNER
    ) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.API_KEY_USAGE_DISABLED,
            message: "API key usage is disabled for non-admin users.",
        } satisfies ServiceError;
    }

    if (
        authResult &&
        options.requiredAuthSource &&
        authResult.principal.source !== options.requiredAuthSource
    ) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "This operation cannot be performed with the current authentication method.",
        } satisfies ServiceError;
    }

    if (
        authResult?.principal.source === 'oauth' &&
        options.requiredOAuthScopes?.length &&
        !hasRequiredOAuthScopes(authResult.principal.oauthScopes, options.requiredOAuthScopes)
    ) {
        return insufficientOAuthScope(options.requiredOAuthScopes);
    }

    const repositoryIds = authResult?.principal.source === 'scoped_access_token'
        ? authResult.principal.repositoryIds
        : undefined;
    const prisma = __unsafePrisma.$extends(
        await userScopedPrismaClientExtension(user, repositoryIds),
    ) as PrismaClient;

    if (user) {
        updateUserLastActiveAt(user);
    }

    // If the user is currently in a "pending"
    // state, then we need to activate them.
    if (
        membership &&
        membership.suspendedAt === null &&
        membership.lastActiveAt === null
    ) {
        const result = await activatePendingMembership(membership);
        if (isServiceError(result)) {
            return result;
        }
    }

    if (membership) {
        updateMembershipLastActiveAt(membership);
    }

    if (user && role && authResult) {
        return { user, org, role, prisma, principal: authResult.principal };
    }
    return { user, org, prisma, principal: authResult?.principal };
};

const updateUserLastActiveAt = (user: UserWithAccounts) => {
    const now = Date.now();
    if (
        user.lastActiveAt &&
        (now - user.lastActiveAt.getTime()) < LAST_ACTIVE_AT_THRESHOLD_MS
    ) {
        return;
    }

    // Fired without a await to avoid blocking.
    void __unsafePrisma.user
        .update({
            where: { id: user.id },
            data: { lastActiveAt: new Date(now) },
        })
        .catch(() => { /* updaing the lastActiveAt is best effort. */ });
};

const updateMembershipLastActiveAt = (membership: UserToOrg) => {
    if (membership.suspendedAt != null) {
        return;
    }

    const now = Date.now();
    if (
        membership.lastActiveAt &&
        (now - membership.lastActiveAt.getTime()) < LAST_ACTIVE_AT_THRESHOLD_MS
    ) {
        return;
    }

    // Fired without a await to avoid blocking; this is only a freshness refresh
    // for already-active memberships, not seat admission.
    void __unsafePrisma.userToOrg
        .updateMany({
            where: {
                orgId: membership.orgId,
                userId: membership.userId,
            },
            data: { lastActiveAt: new Date(now) },
        })
        .catch(() => { /* updating the lastActiveAt is best effort. */ });
};

export const getAuthenticatedUser = async (): Promise<AuthResult | undefined> => {
    // First, check if we have a valid JWT session.
    const session = await auth();
    if (session) {
        const userId = session.user.id;
        const user = await __unsafePrisma.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                accounts: true,
            }
        });

        // Belt-and-braces: nothing today mints a session for a service
        // account (it can only authenticate via API key), but reject one
        // outright if it ever shows up here rather than silently trusting it.
        if (user?.type === UserType.SERVICE) {
            return undefined;
        }

        return user ? { user, principal: { source: 'session' } } : undefined;
    }

    const currentRequest = getCurrentRequest();
    const requestHeaders = currentRequest?.headers ?? await headers();

    // If not, check for a Bearer token in the Authorization header.
    const authorizationHeader = requestHeaders.get("Authorization") ?? undefined;
    const authorization = parseAuthorizationHeader(authorizationHeader);
    if (authorization && (authorization.scheme === 'Bearer' || authorization.scheme === DPOP_AUTH_SCHEME)) {
        const bearerToken = authorization.token;

        // OAuth access token
        if (bearerToken.startsWith(OAUTH_ACCESS_TOKEN_PREFIX)) {
            if (!await hasEntitlement('oauth')) {
                return undefined;
            }

            const secret = bearerToken.slice(OAUTH_ACCESS_TOKEN_PREFIX.length);
            const hash = hashSecret(secret);
            const oauthToken = await __unsafePrisma.oAuthToken.findUnique({
                where: { hash },
                include: { user: { include: { accounts: true } } },
            });
            if (oauthToken && oauthToken.expiresAt > new Date()) {
                if (!oauthToken.dpopJkt && authorization.scheme === DPOP_AUTH_SCHEME) {
                    return undefined;
                }

                if (oauthToken.dpopJkt) {
                    if (authorization.scheme !== DPOP_AUTH_SCHEME || !currentRequest) {
                        return undefined;
                    }

                    const proofResult = await verifyDpopProof({
                        request: currentRequest,
                        proof: requestHeaders.get(DPOP_PROOF_HEADER),
                        expectedJkt: oauthToken.dpopJkt,
                        accessToken: bearerToken,
                        requireAccessTokenHash: true,
                    });

                    if (!proofResult.ok) {
                        return undefined;
                    }
                }

                await __unsafePrisma.oAuthToken.update({
                    where: { hash },
                    data: { lastUsedAt: new Date() },
                });
                return {
                    user: oauthToken.user,
                    principal: {
                        source: 'oauth',
                        oauthScopes: parseOAuthScopeString(oauthToken.scope),
                    },
                };
            }
        }

        if (authorization.scheme !== 'Bearer') {
            return undefined;
        }

        if (bearerToken.startsWith(SCOPED_ACCESS_TOKEN_PREFIX)) {
            if (!await hasEntitlement('scoped-access-tokens')) {
                return undefined;
            }

            const secret = bearerToken.slice(SCOPED_ACCESS_TOKEN_PREFIX.length);
            if (!secret) {
                return undefined;
            }

            const hash = hashSecret(secret);
            const scopedAccessToken = await __unsafePrisma.scopedAccessToken.findUnique({
                where: { hash },
                include: {
                    createdBy: {
                        include: { accounts: true },
                    },
                    repos: {
                        select: { repoId: true },
                    },
                },
            });

            if (!scopedAccessToken || scopedAccessToken.expiresAt <= new Date()) {
                return undefined;
            }

            await __unsafePrisma.scopedAccessToken.update({
                where: { hash },
                data: { lastUsedAt: new Date() },
            });

            return {
                user: scopedAccessToken.createdBy,
                principal: {
                    source: 'scoped_access_token',
                    credentialId: scopedAccessToken.id,
                    orgId: scopedAccessToken.orgId,
                    repositoryIds: scopedAccessToken.repos.map(({ repoId }) => repoId),
                    expiresAt: scopedAccessToken.expiresAt,
                },
            };
        }

        // API key Bearer token (sourcebot-<hex>)
        const apiKey = await getVerifiedApiObject(bearerToken);
        if (apiKey) {
            const user = await __unsafePrisma.user.findUnique({
                where: { id: apiKey.createdById },
                include: { accounts: true },
            });
            if (user) {
                await __unsafePrisma.apiKey.update({
                    where: { hash: apiKey.hash },
                    data: { lastUsedAt: new Date() },
                });
                return { user, principal: { source: 'api_key' } };
            }
        }
    }

    // If not, check if we have a valid API key.
    const apiKeyString = requestHeaders.get("X-Sourcebot-Api-Key") ?? undefined;
    if (apiKeyString) {
        const apiKey = await getVerifiedApiObject(apiKeyString);
        if (!apiKey) {
            return undefined;
        }

        // Attempt to find the user associated with this api key.
        const user = await __unsafePrisma.user.findUnique({
            where: {
                id: apiKey.createdById,
            },
            include: {
                accounts: true,
            }
        });

        if (!user) {
            return undefined;
        }

        // Update the last used at timestamp for this api key.
        await __unsafePrisma.apiKey.update({
            where: {
                hash: apiKey.hash,
            },
            data: {
                lastUsedAt: new Date(),
            },
        });

        return { user, principal: { source: 'api_key' } };
    }

    return undefined;
}

function parseAuthorizationHeader(authorizationHeader: string | undefined): { scheme: string; token: string } | undefined {
    const match = authorizationHeader?.match(/^(\S+)\s+(.+)$/);
    if (!match) {
        return undefined;
    }

    const scheme = match[1].toLowerCase();
    if (scheme === 'bearer') {
        return { scheme: 'Bearer', token: match[2] };
    }

    if (scheme === 'dpop') {
        return { scheme: DPOP_AUTH_SCHEME, token: match[2] };
    }

    return { scheme: match[1], token: match[2] };
}

/**
 * Returns an API key object if the API key string is valid, otherwise returns undefined.
 * Supports both the current prefix (sbk_) and the legacy prefix (sourcebot-).
 */
export const getVerifiedApiObject = async (apiKeyString: string): Promise<ApiKey | undefined> => {
    let secret: string;

    if (apiKeyString.startsWith(API_KEY_PREFIX)) {
        secret = apiKeyString.slice(API_KEY_PREFIX.length);
        if (!secret) {
            return undefined;
        }
    } else if (apiKeyString.startsWith(LEGACY_API_KEY_PREFIX)) {
        secret = apiKeyString.slice(LEGACY_API_KEY_PREFIX.length);
        if (!secret) {
            return undefined;
        }
    } else {
        return undefined;
    }

    const hash = hashSecret(secret);
    const apiKey = await __unsafePrisma.apiKey.findUnique({
        where: {
            hash,
        },
    });

    if (!apiKey) {
        return undefined;
    }

    return apiKey;
}
