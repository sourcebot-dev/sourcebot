import { createAudit } from "@/ee/features/audit/audit";
import { orgHasAvailability } from "@/lib/authUtils";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { syncWithLighthouse } from "@/features/billing/servicePing";
import {
    invalidateAllSessionsForUser,
    revokeUserApiKeysInOrg,
    revokeUserOAuthTokens,
} from "@/features/userManagement/membershipMutations";
import { OrgRole, Prisma } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";

/**
 * SCIM soft-deactivation. Mirrors `_removeUserFromOrg` but, instead of deleting
 * the membership, sets `isActive = false` so the IdP can later reactivate it.
 * Bumps `sessionVersion` (forcing logout on next request) and revokes the
 * user's API keys + OAuth tokens so a deactivated user has no path back in.
 */
export const deactivateScimMember = async (orgId: number, userId: string): Promise<ServiceError | null> => {
    const result = await __unsafePrisma.$transaction(async (tx) => {
        const target = await tx.userToOrg.findUnique({
            where: { orgId_userId: { orgId, userId } },
        });

        if (!target) {
            return notFound("Member not found in this organization");
        }

        // Refuse to deactivate the last active owner — doing so would lock
        // everyone out of org administration.
        if (target.role === OrgRole.OWNER && target.isActive) {
            const activeOwnerCount = await tx.userToOrg.count({
                where: { orgId, role: OrgRole.OWNER, isActive: true },
            });

            if (activeOwnerCount <= 1) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED,
                    message: "Cannot deactivate the last owner of the organization.",
                } satisfies ServiceError;
            }
        }

        await invalidateAllSessionsForUser(tx, userId);
        await revokeUserOAuthTokens(tx, userId);
        await revokeUserApiKeysInOrg(tx, userId, orgId);

        await tx.userToOrg.update({
            where: { orgId_userId: { orgId, userId } },
            data: { isActive: false },
        });

        return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!isServiceError(result)) {
        await syncWithLighthouse(orgId).catch(() => { /* ignore error */ });
        await createAudit({
            action: "org.member_deactivated",
            actor: { id: "scim", type: "scim_token" },
            target: { id: userId, type: "user" },
            orgId,
        });
    }

    return result;
};

/**
 * SCIM reactivation: flips `isActive` back to true. Re-checks seat availability
 * first, since deactivated users free their seat and it may have been filled.
 * Optionally updates the stored IdP `externalId`.
 */
export const reactivateScimMember = async (
    orgId: number,
    userId: string,
    scimExternalId?: string,
): Promise<ServiceError | null> => {
    const target = await __unsafePrisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId } },
    });

    if (!target) {
        return notFound("Member not found in this organization");
    }

    if (!target.isActive) {
        const hasAvailability = await orgHasAvailability(orgId);
        if (!hasAvailability) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
                message: "Organization is at max capacity",
            } satisfies ServiceError;
        }
    }

    await __unsafePrisma.userToOrg.update({
        where: { orgId_userId: { orgId, userId } },
        data: {
            isActive: true,
            ...(scimExternalId ? { scimExternalId } : {}),
        },
    });

    await syncWithLighthouse(orgId).catch(() => { /* ignore error */ });
    await createAudit({
        action: "org.member_reactivated",
        actor: { id: "scim", type: "scim_token" },
        target: { id: userId, type: "user" },
        orgId,
    });

    return null;
};
