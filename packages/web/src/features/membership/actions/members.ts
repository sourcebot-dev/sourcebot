'use server';

import { membershipManagedByIdpError } from "@/features/membership/errors";
import { removeMember, setMembershipSuspended } from "@/features/membership/membership.service";
import { humanMembershipWhere } from "@/features/membership/utils";
import { auditActorForUser } from "@/ee/features/audit/utils";
import { isScimEnabled } from "@/features/scim/utils";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";

export const removeMemberFromOrg = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

            const result = await removeMember(org.id, memberId, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        }))
);

export const suspendMember = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

            const result = await setMembershipSuspended(org.id, memberId, true, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        }))
);

export const reactivateMember = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

            const result = await setMembershipSuspended(org.id, memberId, false, {
                actor: auditActorForUser(user),
            });

            if (isServiceError(result)) {
                return result;
            }

            return { success: true };
        }))
);

export const leaveOrg = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org }) => {
        if (await isScimEnabled(org)) {
            return membershipManagedByIdpError();
        }

        const result = await removeMember(org.id, user.id, {
            actor: { id: user.id, type: "user" },
            reason: "left",
        });

        if (isServiceError(result)) {
            return result;
        }

        return {
            success: true,
        }
    }));


export const getOrgMembers = async () => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // Service accounts have their own management surface (Settings ->
            // Service Accounts) and must not appear in the human members list.
            const members = await prisma.userToOrg.findMany({
                where: {
                    orgId: org.id,
                    ...humanMembershipWhere(),
                },
                include: {
                    user: true,
                },
            });

            return members.map((member) => ({
                id: member.userId,
                email: member.user.email,
                name: member.user.name ?? undefined,
                avatarUrl: member.user.image ?? undefined,
                role: member.role,
                joinedAt: member.joinedAt,
                suspendedAt: member.suspendedAt,
                scimManaged: !!member.scimExternalId,
                lastActiveAt: member.lastActiveAt,
            }));
        })));
