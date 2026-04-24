'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { syncWithLighthouse } from "@/ee/features/lighthouse/servicePing";
import InviteUserEmail from "@/emails/inviteUserEmail";
import JoinRequestApprovedEmail from "@/emails/joinRequestApprovedEmail";
import { addUserToOrganization, orgHasAvailability } from "@/lib/authUtils";
import { ErrorCode } from "@/lib/errorCodes";
import { notFound, ServiceError } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { render } from "@react-email/components";
import { OrgRole, Prisma, PrismaClient } from "@sourcebot/db";
import { createLogger, env, getSMTPConnectionURL } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { createTransport } from "nodemailer";

const logger = createLogger('user-management');

export const removeMemberFromOrg = async (memberId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const guardError = await _removeUserFromOrg(prisma, {
                orgId: org.id,
                userId: memberId,
                lastOwnerMessage: "Cannot remove the last owner of the organization.",
            });

            if (guardError) {
                return guardError;
            }

            return { success: true };
        }))
);

export const leaveOrg = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ user, org, prisma }) => {
        const guardError = await _removeUserFromOrg(prisma, {
            orgId: org.id,
            userId: user.id,
            lastOwnerMessage: "You are the last owner of this organization. Promote another member to owner before leaving.",
        });

        if (guardError) {
            return guardError;
        }

        return {
            success: true,
        }
    }));


const _removeUserFromOrg = async (
    prisma: PrismaClient,
    { orgId, userId, lastOwnerMessage }: { orgId: number; userId: string; lastOwnerMessage: string },
): Promise<ServiceError | null> => {
    const result = await prisma.$transaction(async (tx) => {
        const target = await tx.userToOrg.findUnique({
            where: {
                orgId_userId: {
                    orgId,
                    userId,
                }
            }
        });

        if (!target) {
            return notFound("Member not found in this organization");
        }

        if (target.role === OrgRole.OWNER) {
            const ownerCount = await tx.userToOrg.count({
                where: {
                    orgId,
                    role: OrgRole.OWNER,
                },
            });

            if (ownerCount <= 1) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED,
                    message: lastOwnerMessage,
                } satisfies ServiceError;
            }
        }

        await tx.userToOrg.delete({
            where: {
                orgId_userId: {
                    orgId,
                    userId,
                }
            }
        });

        return null;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Sync with lighthouse s.t., the subscription
    // quantity will update immediately.
    if (!isServiceError(result)) {
        await syncWithLighthouse(orgId).catch(() => { /* ignore error */ });
    }

    return result;
};


export const rejectAccountRequest = async (requestId: string) => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const request = await prisma.accountRequest.findUnique({
                where: {
                    id: requestId,
                },
            });

            if (!request || request.orgId !== org.id) {
                return notFound();
            }

            await prisma.accountRequest.delete({
                where: {
                    id: requestId,
                },
            });

            return {
                success: true,
            }
        })
    ));


export const approveAccountRequest = async (requestId: string) => sew(async () =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const failAuditCallback = async (error: string) => {
                await createAudit({
                    action: "user.join_request_approve_failed",
                    actor: {
                        id: user.id,
                        type: "user"
                    },
                    target: {
                        id: requestId,
                        type: "account_join_request"
                    },
                    orgId: org.id,
                    metadata: {
                        message: error,
                    }
                });
            }

            const request = await prisma.accountRequest.findUnique({
                where: {
                    id: requestId,
                },
                include: {
                    requestedBy: true,
                },
            });

            if (!request || request.orgId !== org.id) {
                await failAuditCallback("Request not found");
                return notFound();
            }

            const addUserToOrgRes = await addUserToOrganization(request.requestedById, org.id);
            if (isServiceError(addUserToOrgRes)) {
                await failAuditCallback(addUserToOrgRes.message);
                return addUserToOrgRes;
            }

            // Send approval email to the user
            const smtpConnectionUrl = getSMTPConnectionURL();
            if (smtpConnectionUrl && env.EMAIL_FROM_ADDRESS) {
                const html = await render(JoinRequestApprovedEmail({
                    baseUrl: env.AUTH_URL,
                    user: {
                        name: request.requestedBy.name ?? undefined,
                        email: request.requestedBy.email!,
                        avatarUrl: request.requestedBy.image ?? undefined,
                    },
                    orgName: org.name,
                }));

                const transport = createTransport(smtpConnectionUrl);
                const result = await transport.sendMail({
                    to: request.requestedBy.email!,
                    from: env.EMAIL_FROM_ADDRESS,
                    subject: `Your request to join ${org.name} has been approved`,
                    html,
                    text: `Your request to join ${org.name} on Sourcebot has been approved. You can now access the organization at ${env.AUTH_URL}`,
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length > 0) {
                    logger.error(`Failed to send approval email to ${request.requestedBy.email}: ${failed}`);
                }
            } else {
                logger.warn(`SMTP_CONNECTION_URL or EMAIL_FROM_ADDRESS not set. Skipping approval email to ${request.requestedBy.email}`);
            }

            await createAudit({
                action: "user.join_request_approved",
                actor: {
                    id: user.id,
                    type: "user"
                },
                orgId: org.id,
                target: {
                    id: requestId,
                    type: "account_join_request"
                }
            });
            return {
                success: true,
            }
        })
    ));



export const createInvites = async (emails: string[]): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
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
                            email: user.email!,
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
                email: member.user.email!,
                name: member.user.name ?? undefined,
                avatarUrl: member.user.image ?? undefined,
                role: member.role,
                joinedAt: member.joinedAt,
            }));
        })));

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


export const getOrgAccountRequests = async () => sew(() =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const requests = await prisma.accountRequest.findMany({
                where: {
                    orgId: org.id,
                },
                include: {
                    requestedBy: true,
                },
            });

            return requests.map((request) => ({
                id: request.id,
                email: request.requestedBy.email!,
                createdAt: request.createdAt,
                name: request.requestedBy.name ?? undefined,
                image: request.requestedBy.image ?? undefined,
            }));
        })));