import { prisma as __unsafePrisma, userScopedPrismaClientExtension } from "@/prisma";
import { hashSecret } from "@sourcebot/crypto";
import { ApiKey, Org, OrgRole, PrismaClient, User } from "@sourcebot/db";
import { headers } from "next/headers";
import { auth } from "./auth";
import { notAuthenticated, notFound, ServiceError } from "./lib/serviceError";
import { SINGLE_TENANT_ORG_ID } from "./lib/constants";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "./lib/errorCodes";
import { getOrgMetadata, isServiceError } from "./lib/utils";
import { hasEntitlement } from "@sourcebot/shared";

interface OptionalAuthContext {
    user?: User;
    org: Org;
    role: OrgRole;
    prisma: PrismaClient;
}

interface RequiredAuthContext {
    user: User;
    org: Org;
    role: Exclude<OrgRole, 'GUEST'>;
    prisma: PrismaClient;
}

export const withAuthV2 = async <T>(fn: (params: RequiredAuthContext) => Promise<T>) => {
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

export const withOptionalAuthV2 = async <T>(fn: (params: OptionalAuthContext) => Promise<T>) => {
    const authContext = await getAuthContext();
    if (isServiceError(authContext)) {
        return authContext;
    }

    const { user, org, role, prisma } = authContext;

    const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
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
    const user = await getAuthenticatedUser();

    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        }
    });

    if (!org) {
        return notFound("Organization not found");
    }

    const membership = user ? await __unsafePrisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                orgId: org.id,
                userId: user.id,
            },
        },
    }) : null;

    const accountIds = user?.accounts.map(account => account.id);
    const prisma = __unsafePrisma.$extends(userScopedPrismaClientExtension(accountIds)) as PrismaClient;

    return {
        user: user ?? undefined,
        org,
        role: membership?.role ?? OrgRole.GUEST,
        prisma,
    };
};

export const getAuthenticatedUser = async () => {
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

        return user ?? undefined;
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

        return user;
    }

    return undefined;
}

/**
 * Returns a API key object if the API key string is valid, otherwise returns undefined.
 */
const getVerifiedApiObject = async (apiKeyString: string): Promise<ApiKey | undefined> => {
    const parts = apiKeyString.split("-");
    if (parts.length !== 2 || parts[0] !== "sourcebot") {
        return undefined;
    }

    const hash = hashSecret(parts[1]);
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

export const withMinimumOrgRole = async <T>(
    userRole: OrgRole,
    minRequiredRole: OrgRole = OrgRole.MEMBER,
    fn: () => Promise<T>,
) => {

    const getAuthorizationPrecedence = (role: OrgRole): number => {
        switch (role) {
            case OrgRole.GUEST:
                return 0;
            case OrgRole.MEMBER:
                return 1;
            case OrgRole.OWNER:
                return 2;
        }
    };

    if (
        getAuthorizationPrecedence(userRole) < getAuthorizationPrecedence(minRequiredRole)
    ) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        } satisfies ServiceError;
    }

    return fn();
}
