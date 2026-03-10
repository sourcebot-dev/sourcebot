'use server';

import { sew } from "@/actions";
import { getAuditService } from "@/ee/features/audit/factory";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { OrgRole } from "@sourcebot/db";
import { hasEntitlement } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";

const auditService = getAuditService();

const orgManagementNotAvailable = (): ServiceError => ({
    statusCode: StatusCodes.FORBIDDEN,
    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
    message: "Organization management is not available in your current plan",
});

export const promoteToOwner = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuthV2(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!hasEntitlement('org-management')) {
                return orgManagementNotAvailable();
            }

            if (memberId === user.id) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "You are already an owner.",
                } satisfies ServiceError;
            }

            const targetMember = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: memberId,
                    },
                },
            });

            if (!targetMember) {
                return notFound("Member not found in this organization");
            }

            if (targetMember.role === OrgRole.OWNER) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "This member is already an owner.",
                } satisfies ServiceError;
            }

            await prisma.userToOrg.update({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: memberId,
                    },
                },
                data: {
                    role: "OWNER",
                },
            });

            await auditService.createAudit({
                action: "org.member_promoted_to_owner",
                actor: { id: user.id, type: "user" },
                target: { id: memberId, type: "user" },
                orgId: org.id,
                metadata: {
                    message: `${user.id} promoted ${memberId} to owner`,
                },
            });

            return { success: true };
        }))
);

export const demoteToMember = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuthV2(async ({ user, org, role }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            if (!hasEntitlement('org-management')) {
                return orgManagementNotAvailable();
            }

            const targetMember = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: memberId,
                    },
                },
            });

            if (!targetMember) {
                return notFound("Member not found in this organization");
            }

            if (targetMember.role !== OrgRole.OWNER) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "This member is not an owner.",
                } satisfies ServiceError;
            }

            const ownerCount = await prisma.userToOrg.count({
                where: {
                    orgId: org.id,
                    role: OrgRole.OWNER,
                },
            });

            if (ownerCount <= 1) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_DEMOTED,
                    message: "Cannot demote the last owner. Promote another member to owner first.",
                } satisfies ServiceError;
            }

            await prisma.userToOrg.update({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: memberId,
                    },
                },
                data: {
                    role: "MEMBER",
                },
            });

            await auditService.createAudit({
                action: "org.owner_demoted_to_member",
                actor: { id: user.id, type: "user" },
                target: { id: memberId, type: "user" },
                orgId: org.id,
                metadata: {
                    message: `${user.id} demoted ${memberId} to member`,
                },
            });

            return { success: true };
        }))
);
