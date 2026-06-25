'use server';

import { membershipManagedByIdpError } from "@/features/membership/errors";
import { removeMember, setMemberActive } from "@/features/membership/membership.service";
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
                actor: { id: user.id, type: "user" },
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

            const result = await setMemberActive(org.id, memberId, false, {
                actor: { id: user.id, type: "user" },
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

            const result = await setMemberActive(org.id, memberId, true, {
                actor: { id: user.id, type: "user" },
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
            const members = await prisma.userToOrg.findMany({
                where: {
                    orgId: org.id,
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
                isActive: member.isActive,
                scimManaged: !!member.scimExternalId,
                lastActiveAt: member.lastActiveAt,
            }));
        })));
