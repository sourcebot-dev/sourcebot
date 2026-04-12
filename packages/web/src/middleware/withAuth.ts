import { __unsafePrisma, userScopedPrismaClientExtension } from "@/prisma";
import { hashSecret, OAUTH_ACCESS_TOKEN_PREFIX, API_KEY_PREFIX, LEGACY_API_KEY_PREFIX, env } from "@sourcebot/shared";
import { ApiKey, Org, OrgRole, PrismaClient, UserWithAccounts } from "@sourcebot/db";
import { headers } from "next/headers";
import { auth } from "../auth";
import { notAuthenticated, notFound, ServiceError } from "../lib/serviceError";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "../lib/errorCodes";
import { getOrgMetadata, isServiceError } from "../lib/utils";
import { hasEntitlement } from "@/lib/entitlements";

type OptionalAuthContext = {
    user?: UserWithAccounts;
    org: Org;
    role: OrgRole;
    prisma: PrismaClient;
}

type RequiredAuthContext = {
    user: UserWithAccounts;
    org: Org;
    role: Exclude<OrgRole, 'GUEST'>;
    prisma: PrismaClient;
}

export const withAuth = async <T>(fn: (params: RequiredAuthContext) => Promise<T>) => {
    const authContext = await getAuthContext();

    if (isServiceError(authContext)) {
        return authContext;
    }

    const { user, org, role, prisma } = authContext;

    if (!user || role === OrgRole.GUEST) {
        return notAuthenticated();
    }

    return fn({ user, org, role, prisma });
};

export const withOptionalAuth = async <T>(fn: (params: OptionalAuthContext) => Promise<T>) => {
    const authContext = await getAuthContext();
    if (isServiceError(authContext)) {
        return authContext;
    }

    const { user, org, role, prisma } = authContext;

    const hasAnonymousAccessEntitlement = await hasEntitlement("anonymous-access");
    const orgMetadata = getOrgMetadata(org);

    if (
        (
            !user ||
            role === OrgRole.GUEST
        ) && (
            !hasAnonymousAccessEntitlement ||
            !orgMetadata?.anonymousAccessEnabled
        )
    ) {
        return notAuthenticated();
    }

    return fn({ user, org, role, prisma });
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

    const role = membership?.role ?? OrgRole.GUEST;

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

    return {
        user: user ?? undefined,
        org,
        role,
        prisma,
    };
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

    // If not, check for a Bearer token in the Authorization header.
    const authorizationHeader = (await headers()).get("Authorization") ?? undefined;
    if (authorizationHeader?.startsWith("Bearer ")) {
        const bearerToken = authorizationHeader.slice(7);

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
                await __unsafePrisma.oAuthToken.update({
                    where: { hash },
                    data: { lastUsedAt: new Date() },
                });
                return { user: oauthToken.user, source: 'oauth' };
            }
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
    const apiKeyString = (await headers()).get("X-Sourcebot-Api-Key") ?? undefined;
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


