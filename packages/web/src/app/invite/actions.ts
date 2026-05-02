"use server";

import { isServiceError } from "@/lib/utils";
import { notAuthenticated, notFound, orgNotFound, ServiceError } from "@/lib/serviceError";
import { sew } from "@/middleware/sew";
import { addUserToOrganization, orgHasAvailability } from "@/lib/authUtils";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { getAuthenticatedUser } from "@/middleware/withAuth";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { getAuditService } from "@/ee/features/audit/factory";

const auditService = getAuditService();

export const joinOrganization = async (inviteLinkId?: string) => sew(async () => {
    const authResult = await getAuthenticatedUser();
    if (!authResult) {
        return notAuthenticated();
    }

    const { user } = authResult;

    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
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

    await auditService.createAudit({
        action: "org.member_added",
        actor: { id: user.id, type: "user" },
        target: { id: user.id, type: "user" },
        orgId: org.id,
        metadata: {
            message: `${user.id} joined the organization via invite link`,
        },
    });

    return {
        success: true,
    }
});

export const redeemInvite = async (inviteId: string): Promise<{ success: boolean; } | ServiceError> => sew(async () => {
    const authResult = await getAuthenticatedUser();
    if (!authResult) {
        return notAuthenticated();
    }

    const { user } = authResult;

    const invite = await __unsafePrisma.invite.findUnique({
        where: {
            id: inviteId,
        },
        include: {
            org: true,
        }
    });

    if (!invite) {
        return notFound();
    }

    const failAuditCallback = async (error: string) => {
        await auditService.createAudit({
            action: "user.invite_accept_failed",
            actor: {
                id: user.id,
                type: "user"
            },
            target: {
                id: inviteId,
                type: "invite"
            },
            orgId: invite.org.id,
            metadata: {
                message: error
            }
        });
    };

    const hasAvailability = await orgHasAvailability();
    if (!hasAvailability) {
        await failAuditCallback("Organization is at max capacity");
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
            message: "Organization is at max capacity",
        } satisfies ServiceError;
    }

    // Check if the user is the recipient of the invite
    if (user.email !== invite.recipientEmail) {
        await failAuditCallback("User is not the recipient of the invite");
        return notFound();
    }

    const addUserToOrgRes = await addUserToOrganization(user.id, invite.orgId);
    if (isServiceError(addUserToOrgRes)) {
        await failAuditCallback(addUserToOrgRes.message);
        return addUserToOrgRes;
    }

    await auditService.createAudit({
        action: "user.invite_accepted",
        actor: {
            id: user.id,
            type: "user"
        },
        orgId: invite.org.id,
        target: {
            id: inviteId,
            type: "invite"
        }
    });

    await auditService.createAudit({
        action: "org.member_added",
        actor: { id: user.id, type: "user" },
        target: { id: user.id, type: "user" },
        orgId: invite.org.id,
        metadata: {
            message: `${user.id} joined the organization by accepting invite ${inviteId}`,
        },
    });

    return {
        success: true,
    };
});


export const getInviteInfo = async (inviteId: string) => sew(async () => {
    const authResult = await getAuthenticatedUser();
    if (!authResult) {
        return notAuthenticated();
    }

    const { user } = authResult;

    const invite = await __unsafePrisma.invite.findUnique({
        where: {
            id: inviteId,
        },
        include: {
            org: true,
            host: true,
        }
    });

    if (!invite) {
        return notFound();
    }

    if (invite.recipientEmail !== user.email) {
        return notFound();
    }

    return {
        id: invite.id,
        orgName: invite.org.name,
        orgImageUrl: invite.org.imageUrl ?? undefined,
        host: {
            name: invite.host.name ?? undefined,
            email: invite.host.email!,
            avatarUrl: invite.host.image ?? undefined,
        },
        recipient: {
            name: user.name ?? undefined,
            email: user.email!,
        }
    };
});

