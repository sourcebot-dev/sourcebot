'use server';

import { sew } from "@/actions";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { prisma } from "@/prisma";
import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { OrgRole, Prisma } from "@sourcebot/db";
import { IS_BILLING_ENABLED } from "@/ee/features/billing/stripe";
import { decrementOrgSeatCount } from "@/ee/features/billing/serverUtils";
import { StatusCodes } from "http-status-codes";

export const removeMemberFromOrg = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuthV2(async ({ org, role }) =>
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

                if (IS_BILLING_ENABLED) {
                    const result = await decrementOrgSeatCount(org.id, tx);
                    if (isServiceError(result)) {
                        throw result;
                    }
                }

                return null;
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

            if (guardError) {
                return guardError;
            }

            return { success: true };
        }))
);

export const leaveOrg = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuthV2(async ({ user, org, role }) => {
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

            if (IS_BILLING_ENABLED) {
                const result = await decrementOrgSeatCount(org.id, tx);
                if (isServiceError(result)) {
                    throw result;
                }
            }

            return null;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        if (guardError) {
            return guardError;
        }

        return {
            success: true,
        }
    }));
