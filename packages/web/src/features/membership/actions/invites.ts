'use server';

import { createAudit } from "@/ee/features/audit/audit";
import InviteUserEmail from "@/emails/inviteUserEmail";
import { addMember } from "@/features/membership/membership.service";
import { getDefaultMemberRole, orgHasAvailability } from "@/features/membership/utils";
import { membershipManagedByIdpError } from "@/features/membership/errors";
import { isScimEnabled } from "@/features/scim/utils";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import { ErrorCode } from "@/lib/errorCodes";
import { notAuthenticated, notFound, orgNotFound, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { getAuthenticatedUser, withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { __unsafePrisma } from "@/prisma";
import { render } from "@react-email/components";
import { OrgRole } from "@sourcebot/db";
import { env, getSMTPConnectionURL, isMemberApprovalRequired } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { createTransport } from "nodemailer";
import { logger } from "../logger";

export const createInvites = async (emails: string[]): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // With SCIM enabled the IdP is the source of truth for membership;
            // invites would add members outside it.
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

            const failAuditCallback = async (error: string) => {
                await createAudit({
                    action: "user.invite_failed",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: org.id.toString(),
                        type: "org"
                    },
                    orgId: org.id,
                    metadata: {
                        message: error,
                        emails: emails.join(", ")
                    }
                });
            }

            const hasAvailability = await orgHasAvailability(org.id);
            if (!hasAvailability) {
                await createAudit({
                    action: "user.invite_failed",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: org.id.toString(),
                        type: "org"
                    },
                    orgId: org.id,
                    metadata: {
                        message: "Organization has reached maximum number of seats",
                        emails: emails.join(", ")
                    }
                });
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
                    message: "The organization has reached the maximum number of seats. Unable to create a new invite",
                } satisfies ServiceError;
            }

            // Check for existing invites
            const existingInvites = await prisma.invite.findMany({
                where: {
                    recipientEmail: {
                        in: emails
                    },
                    orgId: org.id,
                }
            });

            if (existingInvites.length > 0) {
                await failAuditCallback("A pending invite already exists for one or more of the provided emails");
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_INVITE,
                    message: `A pending invite already exists for one or more of the provided emails.`,
                } satisfies ServiceError;
            }

            // Check for members that are already in the org
            const existingMembers = await prisma.userToOrg.findMany({
                where: {
                    user: {
                        email: {
                            in: emails,
                        }
                    },
                    orgId: org.id,
                },
            });

            if (existingMembers.length > 0) {
                await failAuditCallback("One or more of the provided emails are already members of this org");
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_INVITE,
                    message: `One or more of the provided emails are already members of this org.`,
                } satisfies ServiceError;
            }

            await prisma.invite.createMany({
                data: emails.map((email) => ({
                    recipientEmail: email,
                    hostUserId: user.id,
                    orgId: org.id,
                })),
                skipDuplicates: true,
            });

            // Send invites to recipients
            const smtpConnectionUrl = getSMTPConnectionURL();
            if (smtpConnectionUrl && env.EMAIL_FROM_ADDRESS) {
                await Promise.all(emails.map(async (email) => {
                    const invite = await prisma.invite.findUnique({
                        where: {
                            recipientEmail_orgId: {
                                recipientEmail: email,
                                orgId: org.id,
                            },
                        },
                        include: {
                            org: true,
                        }
                    });

                    if (!invite) {
                        return;
                    }

                    const recipient = await prisma.user.findUnique({
                        where: {
                            email,
                        },
                    });
                    const inviteLink = `${env.AUTH_URL}/redeem?invite_id=${invite.id}`;
                    const transport = createTransport(smtpConnectionUrl);
                    const html = await render(InviteUserEmail({
                        baseUrl: env.AUTH_URL,
                        host: {
                            name: user.name ?? undefined,
                            email: user.email,
                            avatarUrl: user.image ?? undefined,
                        },
                        recipient: {
                            name: recipient?.name ?? undefined,
                        },
                        orgName: invite.org.name,
                        orgImageUrl: invite.org.imageUrl ?? undefined,
                        inviteLink,
                    }));

                    const result = await transport.sendMail({
                        to: email,
                        from: env.EMAIL_FROM_ADDRESS,
                        subject: `Join ${invite.org.name} on Sourcebot`,
                        html,
                        text: `Join ${invite.org.name} on Sourcebot by clicking here: ${inviteLink}`,
                    });

                    const failed = result.rejected.concat(result.pending).filter(Boolean);
                    if (failed.length > 0) {
                        logger.error(`Failed to send invite email to ${email}: ${failed}`);
                    }
                }));
            } else {
                logger.warn(`SMTP_CONNECTION_URL or EMAIL_FROM_ADDRESS not set. Skipping invite email to ${emails.join(", ")}`);
            }

            await createAudit({
                action: "user.invites_created",
                actor: {
                    id: user.id,
                    type: "user"
                },
                target: {
                    id: org.id.toString(),
                    type: "org"
                },
                orgId: org.id,
                metadata: {
                    emails: emails.join(", ")
                }
            });
            return {
                success: true,
            }
        })
    ));

export const cancelInvite = async (inviteId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const invite = await prisma.invite.findUnique({
                where: {
                    id: inviteId,
                    orgId: org.id,
                },
            });

            if (!invite) {
                return notFound();
            }

            await prisma.invite.delete({
                where: {
                    id: inviteId,
                },
            });

            return {
                success: true,
            }
        })
    ));

export const getOrgInvites = async () => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const invites = await prisma.invite.findMany({
                where: {
                    orgId: org.id,
                },
            });

            return invites.map((invite) => ({
                id: invite.id,
                email: invite.recipientEmail,
                createdAt: invite.createdAt,
            }));
        })));

// eslint-disable-next-line authz/require-auth-wrapper -- runs pre-org-membership; uses getAuthenticatedUser() directly since withAuth requires a user-to-org link this call is establishing
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

    // With SCIM enabled the IdP is the source of truth for membership; joining
    // via an invite link would bypass it.
    if (await isScimEnabled(org)) {
        return membershipManagedByIdpError();
    }

    // If member approval is required we must be using a valid invite link
    if (isMemberApprovalRequired(org)) {
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

    const addUserToOrgRes = await addMember(org.id, user.id, {
        actor: { id: user.id, type: "user" },
        role: await getDefaultMemberRole(),
    });
    if (isServiceError(addUserToOrgRes)) {
        return addUserToOrgRes;
    }

    return {
        success: true,
    }
});

// eslint-disable-next-line authz/require-auth-wrapper -- runs pre-org-membership; uses getAuthenticatedUser() directly since withAuth requires a user-to-org link this call is establishing
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

    // With SCIM enabled the IdP is the source of truth for membership; accepting
    // an invite would bypass it.
    if (await isScimEnabled(invite.org)) {
        return membershipManagedByIdpError();
    }

    const failAuditCallback = async (error: string) => {
        await createAudit({
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

    const hasAvailability = await orgHasAvailability(invite.org.id);
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

    const addUserToOrgRes = await addMember(invite.orgId, user.id, {
        actor: { id: user.id, type: "user" },
        role: await getDefaultMemberRole(),
    });
    if (isServiceError(addUserToOrgRes)) {
        await failAuditCallback(addUserToOrgRes.message);
        return addUserToOrgRes;
    }

    await createAudit({
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

    return {
        success: true,
    };
});


// eslint-disable-next-line authz/require-auth-wrapper -- runs pre-org-membership; uses getAuthenticatedUser() directly since the invitee is not yet a member
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
            email: invite.host.email,
            avatarUrl: invite.host.image ?? undefined,
        },
        recipient: {
            name: user.name ?? undefined,
            email: user.email,
        }
    };
});
