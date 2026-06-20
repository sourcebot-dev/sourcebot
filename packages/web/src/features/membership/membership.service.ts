import 'server-only';

import { createAudit } from "@/ee/features/audit/audit";
import { type AuditActor } from "@/ee/features/audit/types";
import { syncWithLighthouse } from "@/features/billing/servicePing";
import { orgHasAvailability } from "@/features/membership/utils";
import { notFound, type ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma as prisma } from "@/prisma";
import { OrgRole, Prisma, type UserToOrg } from "@sourcebot/db";
import { lastOwnerDemoteError, lastOwnerError, seatLimitReached } from "./errors";

export interface AddMemberOptions {
    actor: AuditActor;
    role: OrgRole;
    scimExternalId?: string;
}

/**
 * Ensures a membership exists for the user in the org. Idempotent: if a
 * membership already exists (active or inactive) it is returned unchanged — this
 * does NOT reactivate a deactivated membership (that's `setMemberActive`'s job)
 * or change its role. On create, enforces the seat cap and clears any pending
 * invites / account requests for the user.
 *
 * Note: a returned membership may be pre-existing and inactive, so a successful
 * result does not by itself imply the user is active.
 */
export const addMember = async (
    orgId: number,
    userId: string,
    options: AddMemberOptions,
): Promise<UserToOrg | ServiceError> => {
    const { actor, role, scimExternalId } = options;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return notFound("User not found");
    }

    const existing = await prisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId } },
    });
    if (existing) {
        return existing;
    }

    if (!(await orgHasAvailability(orgId))) {
        return seatLimitReached();
    }

    const membership = await prisma.$transaction(async (tx) => {
        const created = await tx.userToOrg.create({
            data: {
                userId,
                orgId,
                role,
                isActive: true,
                ...(scimExternalId ? { scimExternalId } : {}),
            },
        });

        await tx.accountRequest.deleteMany({
            where: { requestedById: userId, orgId },
        });
        await tx.invite.deleteMany({
            where: { recipientEmail: user.email, orgId },
        });

        return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await syncWithLighthouse(orgId).catch(() => { /* best effort */ });
    await createAudit({
        action: "org.member_added",
        actor,
        target: { id: userId, type: "user" },
        orgId,
    });

    return membership;
};


export interface RemoveMemberOptions {
    actor: AuditActor;
    reason?: "removed" | "left";
}

/**
 * Hard-removes a membership (deletes the join row, preserving the `User`).
 * Bumps `sessionVersion` and revokes the user's API keys + OAuth tokens.
 */
export const removeMember = async (
    orgId: number,
    userId: string,
    options: RemoveMemberOptions,
): Promise<ServiceError | null> => {
    const { actor, reason = "removed" } = options;

    const result = await prisma.$transaction(async (tx) => {
        const target = await tx.userToOrg.findUnique({
            where: { orgId_userId: { orgId, userId } },
        });
        if (!target) {
            return notFound("Member not found in this organization");
        }

        if (target.role === OrgRole.OWNER && target.isActive) {
            if ((await countActiveOwners(tx, orgId)) <= 1) {
                return lastOwnerError(reason);
            }
        }

        await revokeAllUserAuthCredentials(tx, userId, orgId);

        await tx.userToOrg.delete({
            where: { orgId_userId: { orgId, userId } },
        });

        return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!isServiceError(result)) {
        await syncWithLighthouse(orgId).catch(() => { /* best effort */ });
        await createAudit({
            action: reason === "left" ? "org.member_left" : "org.member_removed",
            actor,
            target: { id: userId, type: "user" },
            orgId,
        });
    }

    return result;
};


export interface SetMemberRoleOptions {
    actor: AuditActor;
}

/**
 * Changes a member's role (no-op when unchanged). No session/token revocation:
 * role is resolved from the DB on every request, so a change takes effect on the
 * member's next request. Seats are unaffected, so no lighthouse sync.
 */
export const setMemberRole = async (
    orgId: number,
    userId: string,
    role: OrgRole,
    options: SetMemberRoleOptions,
): Promise<ServiceError | null> => {
    const { actor } = options;

    let didChange = false;

    const result = await prisma.$transaction(async (tx) => {
        const target = await tx.userToOrg.findUnique({
            where: { orgId_userId: { orgId, userId } },
        });
        if (!target) {
            return notFound("Member not found in this organization");
        }

        if (target.role === role) {
            return null;
        }

        const isDemotionFromOwner = target.role === OrgRole.OWNER && role !== OrgRole.OWNER;
        if (isDemotionFromOwner && target.isActive) {
            if ((await countActiveOwners(tx, orgId)) <= 1) {
                return lastOwnerDemoteError();
            }
        }

        await tx.userToOrg.update({
            where: { orgId_userId: { orgId, userId } },
            data: { role },
        });
        didChange = true;

        return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (!isServiceError(result) && didChange) {
        await createAudit({
            action: role === OrgRole.OWNER ? "org.member_promoted_to_owner" : "org.owner_demoted_to_member",
            actor,
            target: { id: userId, type: "user" },
            orgId,
        });
    }

    return result;
};

export interface SetMemberActiveOptions {
    actor: AuditActor;
    scimExternalId?: string;
}

/**
 * Suspends (`active: false`) or restores (`active: true`) a membership without
 * deleting it. Deactivation bumps `sessionVersion` + revokes tokens; reactivation
 * re-checks the seat cap. A no-op when already in the requested state.
 */
export const setMemberActive = async (
    orgId: number,
    userId: string,
    active: boolean,
    options: SetMemberActiveOptions,
): Promise<ServiceError | null> => {
    const { actor, scimExternalId } = options;

    if (!active) {
        let didChange = false;

        const result = await prisma.$transaction(async (tx) => {
            const target = await tx.userToOrg.findUnique({
                where: { orgId_userId: { orgId, userId } },
            });
            if (!target) {
                return notFound("Member not found in this organization");
            }
            if (!target.isActive) {
                return null;
            }

            await revokeAllUserAuthCredentials(tx, userId, orgId);

            await tx.userToOrg.update({
                where: { orgId_userId: { orgId, userId } },
                data: { isActive: false },
            });
            didChange = true;

            return null;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        if (!isServiceError(result) && didChange) {
            await syncWithLighthouse(orgId).catch(() => { /* best effort */ });
            await createAudit({
                action: "org.member_deactivated",
                actor,
                target: { id: userId, type: "user" },
                orgId,
            });
        }

        return result;
    }

    const target = await prisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId } },
    });
    if (!target) {
        return notFound("Member not found in this organization");
    }

    if (target.isActive) {
        if (scimExternalId && target.scimExternalId !== scimExternalId) {
            await prisma.userToOrg.update({
                where: { orgId_userId: { orgId, userId } },
                data: { scimExternalId },
            });
        }
        return null;
    }

    if (!(await orgHasAvailability(orgId))) {
        return seatLimitReached();
    }

    await prisma.userToOrg.update({
        where: { orgId_userId: { orgId, userId } },
        data: {
            isActive: true,
            ...(scimExternalId ? { scimExternalId } : {}),
        },
    });

    await syncWithLighthouse(orgId).catch(() => { /* best effort */ });
    await createAudit({
        action: "org.member_reactivated",
        actor,
        target: { id: userId, type: "user" },
        orgId,
    });

    return null;
};

const countActiveOwners = (tx: Prisma.TransactionClient, orgId: number): Promise<number> =>
    tx.userToOrg.count({
        where: { orgId, role: OrgRole.OWNER, isActive: true },
    });

const revokeAllUserAuthCredentials = async (
    prisma: Prisma.TransactionClient,
    userId: string,
    orgId: number,
): Promise<void> => {
    // JWT token
    await prisma.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
    });

    // API Keys
    await prisma.apiKey.deleteMany({
        where: {
            createdById: userId,
            orgId,
        }
    });

    // OAuth tokens
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
