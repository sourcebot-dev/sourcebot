import 'server-only';

import { createAudit } from "@/ee/features/audit/audit";
import { type AuditActor } from "@/ee/features/audit/types";
import { syncWithLighthouse } from "@/features/billing/servicePing";
import { activeMembershipWhere, orgHasAvailability, pendingMembershipWhere } from "@/features/membership/utils";
import { notFound, type ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { __unsafePrisma as prisma } from "@/prisma";
import { OrgRole, Prisma, type UserToOrg } from "@sourcebot/db";
import { lastOwnerDemoteError, lastOwnerError, seatLimitReached } from "./errors";

export interface EnsureActiveMemberOptions {
    actor: AuditActor;
    role: OrgRole;
    scimExternalId?: string;
}

/**
 * Moves an unsuspended pending membership into the active seat set. This is the
 * auth-path admission gate for provisioned users: SCIM/group sync can create
 * pending memberships above the offline seat cap, but the first actual login
 * must reserve a seat before the user gets access.
 */
export const activatePendingMembership = async (
    membership: UserToOrg,
): Promise<ServiceError | null> => {
    if (membership.suspendedAt != null || membership.lastActiveAt != null) {
        return null;
    }

    const activated = await prisma.$transaction(async (tx) => {
        if (!(await orgHasAvailability(membership.orgId, tx))) {
            return seatLimitReached();
        }

        const result = await tx.userToOrg.updateMany({
            where: {
                orgId: membership.orgId,
                userId: membership.userId,
                ...pendingMembershipWhere(),
            },
            data: { lastActiveAt: new Date() },
        });

        return result.count === 1;
    });

    if (isServiceError(activated)) {
        return activated;
    }

    if (activated) {
        await syncWithLighthouse(membership.orgId).catch(() => { /* best effort */ });
    }

    return null;
};

/**
 * Ensures the user has an unsuspended membership. Unsuspended: returned
 * unchanged. Suspended: reactivated (re-checks the seat cap). Otherwise: created.
 * `role` only applies on create. Enforces the seat cap and clears pending
 * invites / account requests for the user.
 */
export const ensureActiveMember = async (
    orgId: number,
    userId: string,
    options: EnsureActiveMemberOptions,
): Promise<UserToOrg | ServiceError> => {
    const { actor, role, scimExternalId } = options;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        return notFound("User not found");
    }

    const existing = await prisma.userToOrg.findUnique({
        where: { orgId_userId: { orgId, userId } },
    });

    if (existing && existing.suspendedAt == null) {
        return existing;
    }
    if (existing && existing.suspendedAt != null) {
        return setMembershipSuspended(orgId, userId, false, {
            actor,
            scimExternalId,
        });
    }

    const membership = await prisma.$transaction(async (tx) => {
        if (!(await orgHasAvailability(orgId, tx))) {
            return seatLimitReached();
        }

        const created = await tx.userToOrg.create({
            data: {
                userId,
                orgId,
                role,
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
    });

    if (isServiceError(membership)) {
        return membership;
    }

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

        if (target.role === OrgRole.OWNER && target.suspendedAt == null) {
            if ((await countActiveOwners(tx, orgId)) <= 1) {
                return lastOwnerError(reason);
            }
        }

        await revokeAllUserAuthCredentials(tx, userId, orgId);

        await tx.userToOrg.delete({
            where: { orgId_userId: { orgId, userId } },
        });

        return null;
    });

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
        if (isDemotionFromOwner && target.suspendedAt == null) {
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
    });

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

export interface SetMembershipSuspendedOptions {
    actor: AuditActor;
    scimExternalId?: string;
}

/**
 * Suspends or restores a membership without deleting it. Suspension bumps
 * `sessionVersion` + revokes tokens; reactivation re-checks the seat cap. A
 * no-op when already in the requested state.
 */
export const setMembershipSuspended = async (
    orgId: number,
    userId: string,
    suspended: boolean,
    options: SetMembershipSuspendedOptions,
): Promise<ServiceError | UserToOrg> => {
    const { actor, scimExternalId } = options;

    if (suspended) {
        let didChange = false;

        const result = await prisma.$transaction(async (tx) => {
            let target = await tx.userToOrg.findUnique({
                where: { orgId_userId: { orgId, userId } },
            });
            if (!target) {
                return notFound("Member not found in this organization");
            }
            if (target.suspendedAt != null) {
                return target;
            }

            await revokeAllUserAuthCredentials(tx, userId, orgId);

            target = await tx.userToOrg.update({
                where: { orgId_userId: { orgId, userId } },
                data: { suspendedAt: new Date() },
            });
            didChange = true;
            return target;
        });

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

    } else {
        let didChange = false;

        const result = await prisma.$transaction(async (tx) => {
            let target = await tx.userToOrg.findUnique({
                where: { orgId_userId: { orgId, userId } },
            });
            if (!target) {
                return notFound("Member not found in this organization");
            }

            if (target.suspendedAt == null) {
                if (scimExternalId && target.scimExternalId !== scimExternalId) {
                    target = await tx.userToOrg.update({
                        where: { orgId_userId: { orgId, userId } },
                        data: { scimExternalId },
                    });
                }
                return target;
            }

            if (!(await orgHasAvailability(orgId, tx))) {
                return seatLimitReached();
            }

            target = await tx.userToOrg.update({
                where: { orgId_userId: { orgId, userId } },
                data: {
                    suspendedAt: null,
                    ...(scimExternalId ? { scimExternalId } : {}),
                },
            });
            didChange = true;
            return target;
        });

        if (!isServiceError(result) && didChange) {
            await syncWithLighthouse(orgId).catch(() => { /* best effort */ });
            await createAudit({
                action: "org.member_reactivated",
                actor,
                target: { id: userId, type: "user" },
                orgId,
            });
        }

        return result;
    }
};

const countActiveOwners = (tx: Prisma.TransactionClient, orgId: number): Promise<number> =>
    tx.userToOrg.count({
        where: {
            orgId,
            ...activeMembershipWhere(),
            role: OrgRole.OWNER,
        },
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
