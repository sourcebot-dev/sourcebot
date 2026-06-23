'use server';

import { createAudit } from "@/ee/features/audit/audit";
import JoinRequestApprovedEmail from "@/emails/joinRequestApprovedEmail";
import { ensureActiveMember } from "@/features/membership/membership.service";
import { getDefaultMemberRole } from "@/features/membership/utils";
import { membershipManagedByIdpError } from "@/features/membership/errors";
import { isScimEnabled } from "@/features/scim/utils";
import { notAuthenticated, notFound } from "@/lib/serviceError";
import { isServiceError } from "@/lib/utils";
import { sew } from "@/middleware/sew";
import { getAuthenticatedUser, withAuth } from "@/middleware/withAuth";
import { withMinimumOrgRole } from "@/middleware/withMinimumOrgRole";
import { render } from "@react-email/components";
import { OrgRole } from "@sourcebot/db";
import { env, getSMTPConnectionURL } from "@sourcebot/shared";
import { createTransport } from "nodemailer";
import { logger } from "../logger";
import { __unsafePrisma } from "@/prisma";
import { SINGLE_TENANT_ORG_ID } from "@/lib/constants";
import JoinRequestSubmittedEmail from "@/emails/joinRequestSubmittedEmail";

// eslint-disable-next-line authz/require-auth-wrapper -- calls getAuthenticatedUser() directly; runs pre-org-membership so cannot use withAuth
export const createAccountRequest = async () => sew(async () => {
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
        return notFound("Organization not found");
    }

    // With SCIM enabled the IdP is the source of truth for membership, so
    // un-provisioned users can't request to join.
    if (await isScimEnabled(org)) {
        return membershipManagedByIdpError();
    }

    const existingRequest = await __unsafePrisma.accountRequest.findUnique({
        where: {
            requestedById_orgId: {
                requestedById: user.id,
                orgId: org.id,
            },
        },
    });

    if (existingRequest) {
        logger.warn(`User ${user.id} already has an account request for org ${org.id}. Skipping account request creation.`);
        return {
            success: true,
            existingRequest: true,
        }
    }

    if (!existingRequest) {
        await __unsafePrisma.accountRequest.create({
            data: {
                requestedById: user.id,
                orgId: org.id,
            },
        });

        const smtpConnectionUrl = getSMTPConnectionURL();
        if (smtpConnectionUrl && env.EMAIL_FROM_ADDRESS) {
            // TODO: This is needed because we can't fetch the origin from the request headers when this is called
            // on user creation (the header isn't set when next-auth calls onCreateUser for some reason)
            const deploymentUrl = env.AUTH_URL;

            const owners = await __unsafePrisma.user.findMany({
                where: {
                    orgs: {
                        some: {
                            orgId: org.id,
                            role: "OWNER",
                        },
                    },
                },
            });

            if (owners.length === 0) {
                logger.error(`Failed to find any owners for org ${org.id} when drafting email for account request from ${user.id}`);
            } else {
                const html = await render(JoinRequestSubmittedEmail({
                    baseUrl: deploymentUrl,
                    requestor: {
                        name: user.name ?? undefined,
                        email: user.email,
                        avatarUrl: user.image ?? undefined,
                    },
                    orgName: org.name,
                    orgImageUrl: org.imageUrl ?? undefined,
                }));

                const ownerEmails = owners
                    .map((owner) => owner.email)
                    .filter((email): email is string => email !== null);

                const transport = createTransport(smtpConnectionUrl);
                const result = await transport.sendMail({
                    to: ownerEmails,
                    from: env.EMAIL_FROM_ADDRESS,
                    subject: `New account request for ${org.name} on Sourcebot`,
                    html,
                    text: `New account request for ${org.name} on Sourcebot by ${user.name ?? user.email}`,
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length > 0) {
                    logger.error(`Failed to send account request email to ${ownerEmails.join(', ')}: ${failed}`);
                }
            }
        } else {
            logger.warn(`SMTP_CONNECTION_URL or EMAIL_FROM_ADDRESS not set. Skipping account request email to owner`);
        }
    }

    return {
        success: true,
        existingRequest: false,
    }
});

export const approveAccountRequest = async (requestId: string) => sew(async () =>
    withAuth(async ({ org, user, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            // With SCIM enabled the IdP is the source of truth for membership;
            // approving a request would mint a member it never provisioned.
            if (await isScimEnabled(org)) {
                return membershipManagedByIdpError();
            }

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

            const addUserToOrgRes = await ensureActiveMember(org.id, request.requestedById, {
                actor: { id: request.requestedById, type: "user" },
                role: await getDefaultMemberRole(),
            });
            if (isServiceError(addUserToOrgRes)) {
                await failAuditCallback(addUserToOrgRes.message);
                return addUserToOrgRes;
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

            // Send approval email to the user
            const smtpConnectionUrl = getSMTPConnectionURL();
            if (smtpConnectionUrl && env.EMAIL_FROM_ADDRESS) {
                const html = await render(JoinRequestApprovedEmail({
                    baseUrl: env.AUTH_URL,
                    user: {
                        name: request.requestedBy.name ?? undefined,
                        email: request.requestedBy.email,
                        avatarUrl: request.requestedBy.image ?? undefined,
                    },
                    orgName: org.name,
                }));

                const transport = createTransport(smtpConnectionUrl);
                const result = await transport.sendMail({
                    to: request.requestedBy.email,
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

            return {
                success: true,
            }
        })
    ));

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
                email: request.requestedBy.email,
                createdAt: request.createdAt,
                name: request.requestedBy.name ?? undefined,
                image: request.requestedBy.image ?? undefined,
            }));
        })));

