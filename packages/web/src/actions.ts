'use server';

import Ajv from "ajv";
import * as Sentry from '@sentry/nextjs';
import { auth } from "./auth";
import { notAuthenticated, notFound, ServiceError, unexpectedError, orgInvalidSubscription, secretAlreadyExists, stripeClientNotInitialized } from "@/lib/serviceError";
import { prisma } from "@/prisma";
import { StatusCodes } from "http-status-codes";
import { ErrorCode } from "@/lib/errorCodes";
import { isServiceError } from "@/lib/utils";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { gerritSchema } from "@sourcebot/schemas/v3/gerrit.schema";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { decrypt, encrypt } from "@sourcebot/crypto"
import { getConnection } from "./data/connection";
import { ConnectionSyncStatus, Prisma, OrgRole, RepoIndexingStatus, StripeSubscriptionStatus } from "@sourcebot/db";
import { cookies, headers } from "next/headers"
import { Session } from "next-auth";
import { env } from "@/env.mjs";
import Stripe from "stripe";
import { render } from "@react-email/components";
import InviteUserEmail from "./emails/inviteUserEmail";
import { createTransport } from "nodemailer";
import { orgDomainSchema, orgNameSchema, repositoryQuerySchema } from "./lib/schemas";
import { TenancyMode } from "./lib/types";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, SINGLE_TENANT_USER_EMAIL, SINGLE_TENANT_USER_ID } from "./lib/constants";
import { stripeClient } from "./lib/stripe";
import { IS_BILLING_ENABLED } from "./lib/stripe";

const ajv = new Ajv({
    validateFormats: false,
});

/**
 * "Service Error Wrapper".
 * 
 * Captures any thrown exceptions and converts them to a unexpected
 * service error. Also logs them with Sentry.
 */
export const sew = async <T>(fn: () => Promise<T>): Promise<T | ServiceError> => {
    try {
        return await fn();
    } catch (e) {
        Sentry.captureException(e);
        console.error(e);
        return unexpectedError(`An unexpected error occurred. Please try again later.`);
    }
}

export const withAuth = async <T>(fn: (session: Session) => Promise<T>, allowSingleTenantUnauthedAccess: boolean = false) => {
    const session = await auth();
    if (!session) {
        if (
            env.SOURCEBOT_TENANCY_MODE === 'single' &&
            env.SOURCEBOT_AUTH_ENABLED === 'false' &&
            allowSingleTenantUnauthedAccess === true
        ) {
            // To allow for unauthed acccess in single-tenant mode, we can
            // create a fake session with the default user. This user has membership
            // in the default org.
            // @see: initialize.ts
            return fn({
                user: {
                    id: SINGLE_TENANT_USER_ID,
                    email: SINGLE_TENANT_USER_EMAIL,
                },
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
            });
        }

        return notAuthenticated();
    }
    return fn(session);
}

export const withOrgMembership = async <T>(session: Session, domain: string, fn: (params: { orgId: number, userRole: OrgRole }) => Promise<T>, minRequiredRole: OrgRole = OrgRole.MEMBER) => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (!org) {
        return notFound();
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId: session.user.id,
                orgId: org.id,
            }
        },
    });

    if (!membership) {
        return notFound();
    }

    const getAuthorizationPrecendence = (role: OrgRole): number => {
        switch (role) {
            case OrgRole.MEMBER:
                return 0;
            case OrgRole.OWNER:
                return 1;
        }
    }


    if (getAuthorizationPrecendence(membership.role) < getAuthorizationPrecendence(minRequiredRole)) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "You do not have sufficient permissions to perform this action.",
        } satisfies ServiceError;
    }

    return fn({
        orgId: org.id,
        userRole: membership.role,
    });
}

export const withTenancyModeEnforcement = async<T>(mode: TenancyMode, fn: () => Promise<T>) => {
    if (env.SOURCEBOT_TENANCY_MODE !== mode) {
        return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.ACTION_DISALLOWED_IN_TENANCY_MODE,
            message: "This action is not allowed in the current tenancy mode.",
        } satisfies ServiceError;
    }
    return fn();
}

////// Actions ///////

export const createOrg = (name: string, domain: string): Promise<{ id: number } | ServiceError> => sew(() =>
    withTenancyModeEnforcement('multi', () =>
        withAuth(async (session) => {
            const org = await prisma.org.create({
                data: {
                    name,
                    domain,
                    members: {
                        create: {
                            role: "OWNER",
                            user: {
                                connect: {
                                    id: session.user.id,
                                }
                            }
                        }
                    }
                }
            });

            return {
                id: org.id,
            }
        })));

export const updateOrgName = async (name: string, domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const { success } = orgNameSchema.safeParse(name);
            if (!success) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "Invalid organization url",
                } satisfies ServiceError;
            }

            await prisma.org.update({
                where: { id: orgId },
                data: { name },
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const updateOrgDomain = async (newDomain: string, existingDomain: string) => sew(() =>
    withTenancyModeEnforcement('multi', () =>
        withAuth((session) =>
            withOrgMembership(session, existingDomain, async ({ orgId }) => {
                const { success } = await orgDomainSchema.safeParseAsync(newDomain);
                if (!success) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: "Invalid organization url",
                    } satisfies ServiceError;
                }

                await prisma.org.update({
                    where: { id: orgId },
                    data: { domain: newDomain },
                });

                return {
                    success: true,
                }
            }, /* minRequiredRole = */ OrgRole.OWNER)
        )));

export const completeOnboarding = async (domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: { id: orgId },
            });

            if (!org) {
                return notFound();
            }

            // If billing is not enabled, we can just mark the org as onboarded.
            if (!IS_BILLING_ENABLED) {
                await prisma.org.update({
                    where: { id: orgId },
                    data: {
                        isOnboarded: true,
                    }
                });

                // Else, validate that the org has an active subscription.
            } else {
                const subscriptionOrError = await fetchSubscription(domain);
                if (isServiceError(subscriptionOrError)) {
                    return subscriptionOrError;
                }

                await prisma.org.update({
                    where: { id: orgId },
                    data: {
                        isOnboarded: true,
                        stripeSubscriptionStatus: StripeSubscriptionStatus.ACTIVE,
                        stripeLastUpdatedAt: new Date(),
                    }
                });
            }

            return {
                success: true,
            }
        })
    ));

export const getSecrets = (domain: string): Promise<{ createdAt: Date; key: string; }[] | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const secrets = await prisma.secret.findMany({
                where: {
                    orgId,
                },
                select: {
                    key: true,
                    createdAt: true
                }
            });

            return secrets.map((secret) => ({
                key: secret.key,
                createdAt: secret.createdAt,
            }));
        })));

export const createSecret = async (key: string, value: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const encrypted = encrypt(value);
            const existingSecret = await prisma.secret.findUnique({
                where: {
                    orgId_key: {
                        orgId,
                        key,
                    }
                }
            });

            if (existingSecret) {
                return secretAlreadyExists();
            }

            await prisma.secret.create({
                data: {
                    orgId,
                    key,
                    encryptedValue: encrypted.encryptedData,
                    iv: encrypted.iv,
                }
            });
            

            return {
                success: true,
            }
        })));

export const checkIfSecretExists = async (key: string, domain: string): Promise<boolean | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const secret = await prisma.secret.findUnique({
                where: {
                    orgId_key: {
                        orgId,
                        key,
                    }
                }
            });

            return !!secret;
        })));

export const deleteSecret = async (key: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            await prisma.secret.delete({
                where: {
                    orgId_key: {
                        orgId,
                        key,
                    }
                }
            });

            return {
                success: true,
            }
        })));


export const getConnections = async (domain: string, filter: { status?: ConnectionSyncStatus[] } = {}) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connections = await prisma.connection.findMany({
                where: {
                    orgId,
                    ...(filter.status ? {
                        syncStatus: { in: filter.status }
                    } : {}),
                },
                include: {
                    repos: {
                        include: {
                            repo: true,
                        }
                    }
                }
            });

            return connections.map((connection) => ({
                id: connection.id,
                name: connection.name,
                syncStatus: connection.syncStatus,
                syncStatusMetadata: connection.syncStatusMetadata,
                connectionType: connection.connectionType,
                updatedAt: connection.updatedAt,
                syncedAt: connection.syncedAt ?? undefined,
                linkedRepos: connection.repos.map(({ repo }) => ({
                    id: repo.id,
                    name: repo.name,
                    repoIndexingStatus: repo.repoIndexingStatus,
                })),
            }));
        })));

export const getConnectionInfo = async (connectionId: number, domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connection = await prisma.connection.findUnique({
                where: {
                    id: connectionId,
                    orgId,
                },
                include: {
                    repos: true,
                }
            });

            if (!connection) {
                return notFound();
            }

            return {
                id: connection.id,
                name: connection.name,
                syncStatus: connection.syncStatus,
                syncStatusMetadata: connection.syncStatusMetadata,
                connectionType: connection.connectionType,
                updatedAt: connection.updatedAt,
                syncedAt: connection.syncedAt ?? undefined,
                numLinkedRepos: connection.repos.length,
            }
        })));

export const getRepos = async (domain: string, filter: { status?: RepoIndexingStatus[], connectionId?: number } = {}) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const repos = await prisma.repo.findMany({
                where: {
                    orgId,
                    ...(filter.status ? {
                        repoIndexingStatus: { in: filter.status }
                    } : {}),
                    ...(filter.connectionId ? {
                        connections: {
                            some: {
                                connectionId: filter.connectionId
                            }
                        }
                    } : {}),
                },
                include: {
                    connections: {
                        include: {
                            connection: true,
                        }
                    }
                }
            });

            return repos.map((repo) => repositoryQuerySchema.parse({
                codeHostType: repo.external_codeHostType,
                repoId: repo.id,
                repoName: repo.name,
                repoCloneUrl: repo.cloneUrl,
                webUrl: repo.webUrl ?? undefined,
                linkedConnections: repo.connections.map(({ connection }) => ({
                    id: connection.id,
                    name: connection.name,
                })),
                imageUrl: repo.imageUrl ?? undefined,
                indexedAt: repo.indexedAt ?? undefined,
                repoIndexingStatus: repo.repoIndexingStatus,
            }));
        }
        ), /* allowSingleTenantUnauthedAccess = */ true));

export const createConnection = async (name: string, type: string, connectionConfig: string, domain: string): Promise<{ id: number } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const parsedConfig = parseConnectionConfig(type, connectionConfig);
            if (isServiceError(parsedConfig)) {
                return parsedConfig;
            }

            const existingConnectionWithName = await prisma.connection.findUnique({
                where: {
                    name_orgId: {
                        orgId,
                        name,
                    }
                }
            });

            if (existingConnectionWithName) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.CONNECTION_ALREADY_EXISTS,
                    message: "A connection with this name already exists.",
                } satisfies ServiceError;
            }

            const connection = await prisma.connection.create({
                data: {
                    orgId,
                    name,
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    connectionType: type,
                }
            });

            return {
                id: connection.id,
            }
        })
    ));

export const updateConnectionDisplayName = async (connectionId: number, name: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            const existingConnectionWithName = await prisma.connection.findUnique({
                where: {
                    name_orgId: {
                        orgId,
                        name,
                    }
                }
            });

            if (existingConnectionWithName) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.CONNECTION_ALREADY_EXISTS,
                    message: "A connection with this name already exists.",
                } satisfies ServiceError;
            }

            await prisma.connection.update({
                where: {
                    id: connectionId,
                    orgId,
                },
                data: {
                    name,
                }
            });

            return {
                success: true,
            }
        })
    ));

export const updateConnectionConfigAndScheduleSync = async (connectionId: number, config: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            const parsedConfig = parseConnectionConfig(connection.connectionType, config);
            if (isServiceError(parsedConfig)) {
                return parsedConfig;
            }

            if (connection.syncStatus === "SYNC_NEEDED" ||
                connection.syncStatus === "IN_SYNC_QUEUE" ||
                connection.syncStatus === "SYNCING") {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.CONNECTION_SYNC_ALREADY_SCHEDULED,
                    message: "Connection is already syncing. Please wait for the sync to complete before updating the connection.",
                } satisfies ServiceError;
            }

            await prisma.connection.update({
                where: {
                    id: connectionId,
                    orgId,
                },
                data: {
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    syncStatus: "SYNC_NEEDED",
                }
            });

            return {
                success: true,
            }
        })
    ));

export const flagConnectionForSync = async (connectionId: number, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection || connection.orgId !== orgId) {
                return notFound();
            }

            await prisma.connection.update({
                where: {
                    id: connection.id,
                },
                data: {
                    syncStatus: "SYNC_NEEDED",
                }
            });

            return {
                success: true,
            }
        })
    ));

export const flagReposForIndex = async (repoIds: number[], domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            await prisma.repo.updateMany({
                where: {
                    id: { in: repoIds },
                    orgId,
                },
                data: {
                    repoIndexingStatus: RepoIndexingStatus.NEW,
                }
            });

            return {
                success: true,
            }
        })
    ));

export const deleteConnection = async (connectionId: number, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const connection = await getConnection(connectionId, orgId);
            if (!connection) {
                return notFound();
            }

            await prisma.connection.delete({
                where: {
                    id: connectionId,
                    orgId,
                }
            });

            return {
                success: true,
            }
        })
    ));

export const getCurrentUserRole = async (domain: string): Promise<OrgRole | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ userRole }) => {
            return userRole;
        })
    ));

export const createInvites = async (emails: string[], domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            // Check for existing invites
            const existingInvites = await prisma.invite.findMany({
                where: {
                    recipientEmail: {
                        in: emails
                    },
                    orgId,
                }
            });

            if (existingInvites.length > 0) {
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
                    orgId,
                },
            });

            if (existingMembers.length > 0) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_INVITE,
                    message: `One or more of the provided emails are already members of this org.`,
                } satisfies ServiceError;
            }

            await prisma.invite.createMany({
                data: emails.map((email) => ({
                    recipientEmail: email,
                    hostUserId: session.user.id,
                    orgId,
                })),
                skipDuplicates: true,
            });

            // Send invites to recipients
            if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM) {
                const origin = (await headers()).get('origin')!;
                await Promise.all(emails.map(async (email) => {
                    const invite = await prisma.invite.findUnique({
                        where: {
                            recipientEmail_orgId: {
                                recipientEmail: email,
                                orgId,
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
                    const inviteLink = `${origin}/redeem?invite_id=${invite.id}`;
                    const transport = createTransport(env.SMTP_CONNECTION_URL);
                    const html = await render(InviteUserEmail({
                        baseUrl: origin,
                        host: {
                            name: session.user.name ?? undefined,
                            email: session.user.email!,
                            avatarUrl: session.user.image ?? undefined,
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
                        from: env.EMAIL_FROM,
                        subject: `Join ${invite.org.name} on Sourcebot`,
                        html,
                        text: `Join ${invite.org.name} on Sourcebot by clicking here: ${inviteLink}`,
                    });

                    const failed = result.rejected.concat(result.pending).filter(Boolean);
                    if (failed.length > 0) {
                        console.error(`Failed to send invite email to ${email}: ${failed}`);
                    }
                }));
            }

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const cancelInvite = async (inviteId: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const invite = await prisma.invite.findUnique({
                where: {
                    id: inviteId,
                    orgId,
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
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const getMe = async () => sew(() =>
    withAuth(async (session) => {
        const user = await prisma.user.findUnique({
            where: {
                id: session.user.id,
            },
            include: {
                orgs: {
                    include: {
                        org: true,
                    }
                },
            }
        });

        if (!user) {
            return notFound();
        }

        return {
            id: user.id,
            email: user.email,
            name: user.name,
            memberships: user.orgs.map((org) => ({
                id: org.orgId,
                role: org.role,
                domain: org.org.domain,
                name: org.org.name,
            }))
        }
    }));

export const redeemInvite = async (inviteId: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async () => {
        const invite = await prisma.invite.findUnique({
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

        const user = await getMe();
        if (isServiceError(user)) {
            return user;
        }

        // Check if the user is the recipient of the invite
        if (user.email !== invite.recipientEmail) {
            return notFound();
        }

        const res = await prisma.$transaction(async (tx) => {
            if (IS_BILLING_ENABLED) {
                // @note: we need to use the internal subscription fetch here since we would otherwise fail the `withOrgMembership` check.
                const subscription = await _fetchSubscriptionForOrg(invite.orgId, tx);
                if (isServiceError(subscription)) {
                    return subscription;
                }

                const existingSeatCount = subscription.items.data[0].quantity;
                const newSeatCount = (existingSeatCount || 1) + 1

                await stripeClient?.subscriptionItems.update(
                    subscription.items.data[0].id,
                    {
                        quantity: newSeatCount,
                        proration_behavior: 'create_prorations',
                    }
                )
            }

            await tx.userToOrg.create({
                data: {
                    userId: user.id,
                    orgId: invite.orgId,
                    role: "MEMBER",
                }
            });

            await tx.invite.delete({
                where: {
                    id: invite.id,
                }
            });
        });

        if (isServiceError(res)) {
            return res;
        }

        return {
            success: true,
        }
    }));

export const getInviteInfo = async (inviteId: string) => sew(() =>
    withAuth(async () => {
        const user = await getMe();
        if (isServiceError(user)) {
            return user;
        }

        const invite = await prisma.invite.findUnique({
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
            orgDomain: invite.org.domain,
            host: {
                name: invite.host.name ?? undefined,
                email: invite.host.email!,
                avatarUrl: invite.host.image ?? undefined,
            },
            recipient: {
                name: user.name ?? undefined,
                email: user.email!,
            }
        }
    }));

export const transferOwnership = async (newOwnerId: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const currentUserId = session.user.id;

            if (newOwnerId === currentUserId) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "You're already the owner of this org",
                } satisfies ServiceError;
            }

            const newOwner = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        userId: newOwnerId,
                        orgId,
                    },
                },
            });

            if (!newOwner) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "The user you're trying to make the owner doesn't exist",
                } satisfies ServiceError;
            }

            await prisma.$transaction([
                prisma.userToOrg.update({
                    where: {
                        orgId_userId: {
                            userId: newOwnerId,
                            orgId,
                        },
                    },
                    data: {
                        role: "OWNER",
                    }
                }),
                prisma.userToOrg.update({
                    where: {
                        orgId_userId: {
                            userId: currentUserId,
                            orgId,
                        },
                    },
                    data: {
                        role: "MEMBER",
                    }
                })
            ]);

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const createOnboardingSubscription = async (domain: string) => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org) {
                return notFound();
            }

            const user = await getMe();
            if (isServiceError(user)) {
                return user;
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const test_clock = env.STRIPE_ENABLE_TEST_CLOCKS === 'true' ? await stripeClient.testHelpers.testClocks.create({
                frozen_time: Math.floor(Date.now() / 1000)
            }) : null;

            // Use the existing customer if it exists, otherwise create a new one.
            const customerId = await (async () => {
                if (org.stripeCustomerId) {
                    return org.stripeCustomerId;
                }

                const customer = await stripeClient.customers.create({
                    name: org.name,
                    email: user.email ?? undefined,
                    test_clock: test_clock?.id,
                    description: `Created by ${user.email} on ${domain} (id: ${org.id})`,
                });

                await prisma.org.update({
                    where: {
                        id: org.id,
                    },
                    data: {
                        stripeCustomerId: customer.id,
                    }
                });

                return customer.id;
            })();

            const existingSubscription = await fetchSubscription(domain);
            if (!isServiceError(existingSubscription)) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.SUBSCRIPTION_ALREADY_EXISTS,
                    message: "Attemped to create a trial subscription for an organization that already has an active subscription",
                } satisfies ServiceError;
            }


            const prices = await stripeClient.prices.list({
                product: env.STRIPE_PRODUCT_ID,
                expand: ['data.product'],
            });

            try {
                const subscription = await stripeClient.subscriptions.create({
                    customer: customerId,
                    items: [{
                        price: prices.data[0].id,
                    }],
                    trial_period_days: 14,
                    trial_settings: {
                        end_behavior: {
                            missing_payment_method: 'cancel',
                        },
                    },
                    payment_settings: {
                        save_default_payment_method: 'on_subscription',
                    },
                });

                if (!subscription) {
                    return {
                        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                        errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                        message: "Failed to create subscription",
                    } satisfies ServiceError;
                }

                return {
                    subscriptionId: subscription.id,
                }
            } catch (e) {
                console.error(e);
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                    message: "Failed to create subscription",
                } satisfies ServiceError;
            }


        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const createStripeCheckoutSession = async (domain: string) => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const orgMembers = await prisma.userToOrg.findMany({
                where: {
                    orgId,
                },
                select: {
                    userId: true,
                }
            });
            const numOrgMembers = orgMembers.length;

            const origin = (await headers()).get('origin')!;
            const prices = await stripeClient.prices.list({
                product: env.STRIPE_PRODUCT_ID,
                expand: ['data.product'],
            });

            const stripeSession = await stripeClient.checkout.sessions.create({
                customer: org.stripeCustomerId as string,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: prices.data[0].id,
                        quantity: numOrgMembers
                    }
                ],
                mode: 'subscription',
                payment_method_collection: 'always',
                success_url: `${origin}/${domain}/settings/billing`,
                cancel_url: `${origin}/${domain}`,
            });

            if (!stripeSession.url) {
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.STRIPE_CHECKOUT_ERROR,
                    message: "Failed to create checkout session",
                } satisfies ServiceError;
            }

            return {
                url: stripeSession.url,
            }
        })
    ));

export const getCustomerPortalSessionLink = async (domain: string): Promise<string | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const origin = (await headers()).get('origin')!;
            const portalSession = await stripeClient.billingPortal.sessions.create({
                customer: org.stripeCustomerId as string,
                return_url: `${origin}/${domain}/settings/billing`,
            });

            return portalSession.url;
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const fetchSubscription = (domain: string): Promise<Stripe.Subscription | ServiceError> => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            return _fetchSubscriptionForOrg(orgId, prisma);
        })
    ));

export const getSubscriptionBillingEmail = async (domain: string): Promise<string | ServiceError> => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            const customer = await stripeClient.customers.retrieve(org.stripeCustomerId);
            if (!('email' in customer) || customer.deleted) {
                return notFound();
            }
            return customer.email!;
        })
    ));

export const changeSubscriptionBillingEmail = async (domain: string, newEmail: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org || !org.stripeCustomerId) {
                return notFound();
            }

            if (!stripeClient) {
                return stripeClientNotInitialized();
            }

            await stripeClient.customers.update(org.stripeCustomerId, {
                email: newEmail,
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const checkIfOrgDomainExists = async (domain: string): Promise<boolean | ServiceError> => sew(() =>
    withAuth(async () => {
        const org = await prisma.org.findFirst({
            where: {
                domain,
            }
        });

        return !!org;
    }));

export const removeMemberFromOrg = async (memberId: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const targetMember = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: memberId,
                    }
                }
            });

            if (!targetMember) {
                return notFound();
            }

            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org) {
                return notFound();
            }

            if (IS_BILLING_ENABLED) {
                const subscription = await fetchSubscription(domain);
                if (isServiceError(subscription)) {
                    return subscription;
                }

                const existingSeatCount = subscription.items.data[0].quantity;
                const newSeatCount = (existingSeatCount || 1) - 1;

                await stripeClient?.subscriptionItems.update(
                    subscription.items.data[0].id,
                    {
                        quantity: newSeatCount,
                        proration_behavior: 'create_prorations',
                    }
                )
            }

            await prisma.userToOrg.delete({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: memberId,
                    }
                }
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const leaveOrg = async (domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId, userRole }) => {
            if (userRole === OrgRole.OWNER) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.OWNER_CANNOT_LEAVE_ORG,
                    message: "Organization owners cannot leave their own organization",
                } satisfies ServiceError;
            }

            const org = await prisma.org.findUnique({
                where: {
                    id: orgId,
                },
            });

            if (!org) {
                return notFound();
            }

            if (IS_BILLING_ENABLED) {
                const subscription = await fetchSubscription(domain);
                if (isServiceError(subscription)) {
                    return subscription;
                }

                const existingSeatCount = subscription.items.data[0].quantity;
                const newSeatCount = (existingSeatCount || 1) - 1;

                await stripeClient?.subscriptionItems.update(
                    subscription.items.data[0].id,
                    {
                        quantity: newSeatCount,
                        proration_behavior: 'create_prorations',
                    }
                )
            }

            await prisma.userToOrg.delete({
                where: {
                    orgId_userId: {
                        orgId,
                        userId: session.user.id,
                    }
                }
            });

            return {
                success: true,
            }
        })
    ));

export const getSubscriptionData = async (domain: string) => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async () => {
            const subscription = await fetchSubscription(domain);
            if (isServiceError(subscription)) {
                return subscription;
            }

            if (!subscription) {
                return null;
            }

            return {
                plan: "Team",
                seats: subscription.items.data[0].quantity!,
                perSeatPrice: subscription.items.data[0].price.unit_amount! / 100,
                nextBillingDate: subscription.current_period_end!,
                status: subscription.status,
            }
        })
    ));

export const getOrgMembers = async (domain: string) => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const members = await prisma.userToOrg.findMany({
                where: {
                    orgId,
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
        })
    ));

export const getOrgInvites = async (domain: string) => sew(() =>
    withAuth(async (session) =>
        withOrgMembership(session, domain, async ({ orgId }) => {
            const invites = await prisma.invite.findMany({
                where: {
                    orgId,
                },
            });

            return invites.map((invite) => ({
                id: invite.id,
                email: invite.recipientEmail,
                createdAt: invite.createdAt,
            }));
        })
    ));

export const dismissMobileUnsupportedSplashScreen = async () => sew(async () => {
    await cookies().set(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, 'true');
    return true;
});


////// Helpers ///////

const _fetchSubscriptionForOrg = async (orgId: number, prisma: Prisma.TransactionClient): Promise<Stripe.Subscription | ServiceError> => {
    const org = await prisma.org.findUnique({
        where: {
            id: orgId,
        },
    });

    if (!org) {
        return notFound();
    }

    if (!org.stripeCustomerId) {
        return notFound();
    }

    if (!stripeClient) {
        return stripeClientNotInitialized();
    }

    const subscriptions = await stripeClient.subscriptions.list({
        customer: org.stripeCustomerId
    });

    if (subscriptions.data.length === 0) {
        return orgInvalidSubscription();
    }
    return subscriptions.data[0];
}

const parseConnectionConfig = (connectionType: string, config: string) => {
    let parsedConfig: ConnectionConfig;
    try {
        parsedConfig = JSON.parse(config);
    } catch (_e) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "config must be a valid JSON object."
        } satisfies ServiceError;
    }

    const schema = (() => {
        switch (connectionType) {
            case "github":
                return githubSchema;
            case "gitlab":
                return gitlabSchema;
            case 'gitea':
                return giteaSchema;
            case 'gerrit':
                return gerritSchema;
        }
    })();

    if (!schema) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "invalid connection type",
        } satisfies ServiceError;
    }

    const isValidConfig = ajv.validate(schema, parsedConfig);
    if (!isValidConfig) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `config schema validation failed with errors: ${ajv.errorsText(ajv.errors)}`,
        } satisfies ServiceError;
    }

    if ('token' in parsedConfig && parsedConfig.token && 'env' in parsedConfig.token) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: "Environment variables are not supported for connections created in the web UI. Please use a secret instead.",
        } satisfies ServiceError;
    }

    const { numRepos, hasToken } = (() => {
        switch (parsedConfig.type) {
            case "gitea":
            case "github": {
                return {
                    numRepos: parsedConfig.repos?.length,
                    hasToken: !!parsedConfig.token,
                }
            }
            case "gitlab": {
                return {
                    numRepos: parsedConfig.projects?.length,
                    hasToken: !!parsedConfig.token,
                }
            }
            case "gerrit": {
                return {
                    numRepos: parsedConfig.projects?.length,
                    hasToken: true, // gerrit doesn't use a token atm
                }
            }
        }
    })();

    if (!hasToken && numRepos && numRepos > env.CONFIG_MAX_REPOS_NO_TOKEN) {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_REQUEST_BODY,
            message: `You must provide a token to sync more than ${env.CONFIG_MAX_REPOS_NO_TOKEN} repositories.`,
        } satisfies ServiceError;
    }

    return parsedConfig;
}

export const encryptValue = async (value: string) => {
    return encrypt(value);
}

export const decryptValue = async (iv: string, encryptedValue: string) => {
    return decrypt(iv, encryptedValue);
}