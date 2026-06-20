import { __unsafePrisma } from "@/prisma";
import { hasEntitlement } from "@/lib/entitlements";
import { createLogger, getSeatCap } from "@sourcebot/shared";
import { OrgRole } from "@sourcebot/db";

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
 * Checks to see if the given organization has seat availability. Seat
 * availability is determined by the `seats` parameter in the offline license
 * key, if available.
 */
export const orgHasAvailability = async (orgId: number): Promise<boolean> => {
    const seatCap = getSeatCap();

    // SCIM-deactivated members don't consume a seat, so they free up capacity
    // for new provisions while their membership row is preserved.
    const activeUserCount = await __unsafePrisma.userToOrg.count({
        where: {
            orgId,
            isActive: true,
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
