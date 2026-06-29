import { __unsafePrisma, userScopedPrismaClientExtension } from "@/prisma";
import { hashSecret, OAUTH_ACCESS_TOKEN_PREFIX, API_KEY_PREFIX, LEGACY_API_KEY_PREFIX, env } from "@sourcebot/shared";
import { ApiKey, Org, OrgRole, PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { headers } from "next/headers";
import { auth } from "../auth";
import { notAuthenticated, notFound, ServiceError } from "../lib/serviceError";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "../lib/errorCodes";
import { isServiceError } from "../lib/utils";
import { hasEntitlement, isAnonymousAccessEnabled } from "@/lib/entitlements";
import { DPOP_AUTH_SCHEME, DPOP_PROOF_HEADER, verifyDpopProof } from "@/ee/features/oauth/dpop";
import { getCurrentRequest } from "@/lib/requestContext";

const LAST_ACTIVE_AT_THRESHOLD_MS = 5 * 60 * 1000;

type RequiredAuthContext = {
    user: UserWithAccounts;
    role: OrgRole;
    org: Org;
    prisma: PrismaClient;
};

type OptionalAuthContext =
    | RequiredAuthContext
    | {
        user?: UserWithAccounts;
        role?: undefined;
        org: Org;
        prisma: PrismaClient;
    };


export const withAuth = async <T>(fn: (params: RequiredAuthContext) => Promise<T>) => {
    const authContext = await getAuthContext();

    if (isServiceError(authContext)) {
        return authContext;
    }

    const { user, org, role, prisma } = authContext;

    if (!user || !role) {
        return notAuthenticated();
    }

    return fn({ user, org, role, prisma });
};

export const withOptionalAuth = async <T>(fn: (params: OptionalAuthContext) => Promise<T>) => {
    const authContext = await getAuthContext();
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

export const getAuthContext = async (): Promise<OptionalAuthContext | ServiceError> => {
    const authResult = await getAuthenticatedUser();

    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        }
    });

    if (!org) {
        return notFound("Organization not found");
    }

    const user = authResult?.user;

    const membership = user ? await __unsafePrisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: user.id,
            },
        },
    }) : null;

    const role = membership?.role;

    if (
        env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true' &&
        authResult?.source === 'api_key' &&
        role !== OrgRole.OWNER
    ) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.API_KEY_USAGE_DISABLED,
            message: "API key usage is disabled for non-admin users.",
        } satisfies ServiceError;
    }

    const prisma = __unsafePrisma.$extends(await userScopedPrismaClientExtension(user)) as PrismaClient;

    if (user) {
        updateUserLastActiveAt(user);
    }

    if (user && role) {
        return { user, org, role, prisma };
    }
    return { user, org, prisma };
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

type AuthSource = 'session' | 'oauth' | 'api_key';

export const getAuthenticatedUser = async (): Promise<{ user: UserWithAccounts, source: AuthSource } | undefined> => {
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

        return user ? { user, source: 'session' } : undefined;
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
                return { user: oauthToken.user, source: 'oauth' };
            }
        }

        if (authorization.scheme !== 'Bearer') {
            return undefined;
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
                return { user, source: 'api_key' };
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

        return { user, source: 'api_key' };
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
