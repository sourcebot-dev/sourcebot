import { hasEntitlement } from "@/lib/entitlements";
import { createLogger, getSeatCap } from "@sourcebot/shared";
import { OrgRole, Prisma } from "@sourcebot/db";

const logger = createLogger("membership-utils");

/**
 * Resolves the role a user receives when joining the org via invite,
 * account-request approval, or interactive-login auto-join. On paid plans (the
 * `org-management` entitlement) joiners are MEMBERs; on free plans there is no
 * role distinction, so they join as OWNER.
 */
export const getDefaultMemberRole = async (): Promise<OrgRole> =>
    (await hasEntitlement("org-management")) ? OrgRole.MEMBER : OrgRole.OWNER;

/**
 * Matches suspended memberships.
 */
export const suspendedMembershipWhere = (): Prisma.UserToOrgWhereInput => ({
    suspendedAt: { not: null },
});

/**
 * Matches unsuspended memberships, regardless of activity.
 */
export const unsuspendedMembershipWhere = (): Prisma.UserToOrgWhereInput => ({
    suspendedAt: null,
});

/**
 * Matches pending memberships: unsuspended and never seen.
 */
export const pendingMembershipWhere = (): Prisma.UserToOrgWhereInput => ({
    ...unsuspendedMembershipWhere(),
    lastActiveAt: null,
});

/**
 * Matches active memberships: unsuspended and seen at least once.
 */
export const activeMembershipWhere = (): Prisma.UserToOrgWhereInput => ({
    ...unsuspendedMembershipWhere(),
    lastActiveAt: { not: null },
});

/**
 * Checks to see if the given organization has seat availability. Seat
 * availability is determined by the `seats` parameter in the offline license
 * key, if available.
 */
export const orgHasAvailability = async (orgId: number, tx: Prisma.TransactionClient): Promise<boolean> => {
    const seatCap = getSeatCap();

    // Pending and suspended members are preserved but don't consume seats.
    const activeUserCount = await tx.userToOrg.count({
        where: {
            orgId,
            ...activeMembershipWhere(),
        },
    });

    if (
        seatCap &&
        activeUserCount >= seatCap
    ) {
        logger.error(`orgHasAvailability: org ${orgId} has reached max capacity`);
        return false;
    }

    return true;
};
