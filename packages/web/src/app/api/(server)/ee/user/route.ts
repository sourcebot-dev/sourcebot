'use server';

import { withAuthV2, withMinimumOrgRole } from "@/withAuthV2";
import { OrgRole } from "@sourcebot/db";
import { isServiceError } from "@/lib/utils";
import { serviceErrorResponse, missingQueryParam, notFound } from "@/lib/serviceError";
import { createLogger } from "@sourcebot/shared";
import { NextRequest } from "next/server";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { getAuditService } from "@/ee/features/audit/factory";

const logger = createLogger('ee-user-api');
const auditService = getAuditService();

export const DELETE = async (request: NextRequest) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return serviceErrorResponse(missingQueryParam('userId'));
    }

    const result = await withAuthV2(async ({ org, role, user: currentUser, prisma }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                if (currentUser.id === userId) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: 'Cannot delete your own user account',
                    };
                }

                const targetUser = await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                });

                if (!targetUser) {
                    return notFound('User not found');
                }

                await auditService.createAudit({
                    action: "user.delete",
                    actor: {
                        id: currentUser.id,
                        type: "user"
                    },
                    target: {
                        id: userId,
                        type: "user"
                    },
                    orgId: org.id,
                });

                // Delete the user (cascade will handle all related records)
                await prisma.user.delete({
                    where: {
                        id: userId,
                    },
                });

                logger.info('User deleted successfully', { 
                    deletedUserId: userId,
                    deletedByUserId: currentUser.id,
                    orgId: org.id
                });

                return { 
                    success: true,
                    message: 'User deleted successfully'
                };
            } catch (error) {
                logger.error('Error deleting user', { error, userId });
                throw error;
            }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
};

