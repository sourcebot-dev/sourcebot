import { Prisma } from "@sourcebot/db";

/**
 * Low-level membership mutation helpers shared between user-management server
 * actions and SCIM provisioning. These are plain functions (not server
 * actions) so they can be imported by both `actions.ts` and the SCIM feature;
 * they must NOT live in a `'use server'` module.
 */

/**
 * Invalidates every active JWT cookie for the given user by incrementing
 * their `sessionVersion`. The next request from any of their active
 * sessions will compare the cookie's baked-in version against the
 * (now-bumped) value on the User row, fail, and be treated as logged out.
 */
export const invalidateAllSessionsForUser = async (
    prisma: Prisma.TransactionClient,
    userId: string,
): Promise<void> => {
    await prisma.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
    });
};

export const revokeUserApiKeysInOrg = async (
    prisma: Prisma.TransactionClient,
    userId: string,
    orgId: number,
): Promise<void> => {
    await prisma.apiKey.deleteMany({
        where: {
            createdById: userId,
            orgId,
        }
    });
};

export const revokeUserOAuthTokens = async (
    prisma: Prisma.TransactionClient,
    userId: string,
): Promise<void> => {
    await prisma.oAuthToken.deleteMany({
        where: {
            userId
        }
    });
    await prisma.oAuthRefreshToken.deleteMany({
        where: {
            userId
        }
    });
    await prisma.oAuthAuthorizationCode.deleteMany({
        where: {
            userId
        }
    });
};
