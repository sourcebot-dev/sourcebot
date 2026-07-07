'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { membershipManagedByIdpError } from "@/features/membership/errors";
import { removeMember } from "@/features/membership/membership.service";
import { isScimEnabled } from "@/features/scim/utils";
import { toPublicUser } from "../utils";
import { apiHandler } from "@/lib/apiHandler";
import { ErrorCode } from "@/lib/errorCodes";
import { serviceErrorResponse, missingQueryParam, notFound } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { OrgRole } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { hasEntitlement } from "@/lib/entitlements";
import { StatusCodes } from "http-status-codes";
import { NextRequest } from "next/server";

const logger = createLogger('ee-user-api');

export const GET = apiHandler(async (request: NextRequest) => {
    if (!await hasEntitlement('org-management')) {
        return serviceErrorResponse({
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "Organization management is not enabled for your license",
        });
    }

    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return serviceErrorResponse(missingQueryParam('userId'));
    }

    const result = await withAuth(async ({ org, role, user, prisma }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            try {
                const membership = await prisma.userToOrg.findUnique({
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId,
                        },
                    },
                    include: {
                        user: true,
                    },
                });

                if (!membership) {
                    return notFound('User not found');
                }

                await createAudit({
                    action: "user.read",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: userId,
                        type: "user"
                    },
                    orgId: org.id,
                });

                return toPublicUser(membership);
            } catch (error) {
                logger.error('Error fetching user info', { error, userId });
                throw error;
            }
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

export const DELETE = apiHandler(async (request: NextRequest) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return serviceErrorResponse(missingQueryParam('userId'));
    }

    const result = await withAuth(async ({ org, role, user: currentUser }) => {
        return withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // When SCIM is enabled the IdP is the source of truth for membership,
            // so deleting users outside of it is disabled.
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

            const error = await removeMember(org.id, userId, {
                actor: { id: currentUser.id, type: "user" },
            });

            if (isServiceError(error)) {
                return error;
            }

            logger.info('User deleted successfully', {
                deletedUserId: userId,
                deletedByUserId: currentUser.id,
                orgId: org.id,
            });

            return {
                success: true,
                message: 'User deleted successfully',
            };
        });
    });

    if (isServiceError(result)) {
        return serviceErrorResponse(result);
    }

    return Response.json(result, { status: StatusCodes.OK });
});

