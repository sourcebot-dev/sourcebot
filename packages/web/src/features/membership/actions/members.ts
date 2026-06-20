'use server';

import { removeMember } from "@/features/membership/membership.service";
import { ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";

export const removeMemberFromOrg = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const result = await removeMember(org.id, memberId, {
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
            }));
        })));