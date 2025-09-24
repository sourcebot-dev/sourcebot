"use server";

import { isServiceError } from "@/lib/utils";
import { notAuthenticated, orgNotFound, ServiceError } from "@/lib/serviceError";
import { sew } from "@/sew";
import { addUserToOrganization } from "@/lib/authUtils";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { withOptionalAuthV2 } from "@/withAuthV2";

export const joinOrganization = async (orgId: number, inviteLinkId?: string) => sew(async () =>
    withOptionalAuthV2(async ({ user }) => {
        if (!user) {
            return notAuthenticated();
        }

        const org = await prisma.org.findUnique({
            where: {
                id: orgId,
            },
        });
        
        if (!org) {
            return orgNotFound();
        }

        // If member approval is required we must be using a valid invite link
        if (org.memberApprovalRequired) {
            if (!org.inviteLinkEnabled) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVITE_LINK_NOT_ENABLED,
                    message: "Invite link is not enabled.",
                } satisfies ServiceError;
            }

            if (org.inviteLinkId !== inviteLinkId) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_INVITE_LINK,
                    message: "Invalid invite link.",
                } satisfies ServiceError;
            }
        }

        const addUserToOrgRes = await addUserToOrganization(user.id, org.id);
        if (isServiceError(addUserToOrgRes)) {
            return addUserToOrgRes;
        }

        return {
            success: true,
        }
    })
) 