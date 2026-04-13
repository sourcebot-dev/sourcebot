'use server';

import { sew } from "@/middleware/sew";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole, Prisma } from "@sourcebot/db";
import { StatusCodes } from "http-status-codes";

export const removeMemberFromOrg = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const guardError = await prisma.$transaction(async (tx) => {
                const targetMember = await tx.userToOrg.findUnique({
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId: memberId,
                        }
                    }
                });

                if (!targetMember) {
                    return notFound("Member not found in this organization");
                }

                if (targetMember.role === OrgRole.OWNER) {
                    const ownerCount = await tx.userToOrg.count({
                        where: {
                            orgId: org.id,
                            role: OrgRole.OWNER,
                        },
                    });

                    if (ownerCount <= 1) {
                        return {
                            statusCode: StatusCodes.FORBIDDEN,
                            errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED,
                            message: "Cannot remove the last owner of the organization.",
                        } satisfies ServiceError;
                    }
                }

                await tx.userToOrg.delete({
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId: memberId,
                        }
                    }
                });

                return null;
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

            if (guardError) {
                return guardError;
            }

            return { success: true };
        }))
);

export const leaveOrg = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, role, prisma }) => {
        const guardError = await prisma.$transaction(async (tx) => {
            if (role === OrgRole.OWNER) {
                const ownerCount = await tx.userToOrg.count({
                    where: {
                        orgId: org.id,
                        role: OrgRole.OWNER,
                    },
                });

                if (ownerCount <= 1) {
                    return {
                        statusCode: StatusCodes.FORBIDDEN,
                        errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED,
                        message: "You are the last owner of this organization. Promote another member to owner before leaving.",
                    } satisfies ServiceError;
                }
            }

            await tx.userToOrg.delete({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: user.id,
                    }
                }
            });

            return null;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        if (guardError) {
            return guardError;
        }

        return {
            success: true,
        }
    }));
