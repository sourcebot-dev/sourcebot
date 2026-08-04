'use server';

import { sew } from "@/middleware/sew";
import { ErrorCode } from "@/lib/errorCodes";
import { ServiceError } from "@/lib/serviceError";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { hasEntitlement } from "@/lib/entitlements";
import { isServiceError } from "@/lib/utils";
import { setMemberRole } from "@/features/membership/membership.service";
import { StatusCodes } from "http-status-codes";

const orgManagementNotAvailable = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "Organization management is not available in your current plan",
});

export const promoteToOwner = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('org-management')) {
                return orgManagementNotAvailable();
            }

            const result = await setMemberRole(org.id, memberId, OrgRole.OWNER, {
                actor: { id: user.id, type: "user" },
            });
            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        }))
);

export const demoteToMember = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!await hasEntitlement('org-management')) {
                return orgManagementNotAvailable();
            }

            const result = await setMemberRole(org.id, memberId, OrgRole.MEMBER, {
                actor: { id: user.id, type: "user" },
            });
            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        }))
);
