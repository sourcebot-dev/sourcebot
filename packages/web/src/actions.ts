'use server';

import { env } from "@/env.mjs";
import { ErrorCode } from "@/lib/errorCodes";
import { notAuthenticated, notFound, secretAlreadyExists, ServiceError, ServiceErrorException, unexpectedError } from "@/lib/serviceError";
import { CodeHostType, isServiceError } from "@/lib/utils";
import { prisma } from "@/prisma";
import { render } from "@react-email/components";
import * as Sentry from '@sentry/nextjs';
import { decrypt, encrypt, generateApiKey, getApiKeyPrefix } from "@sourcebot/crypto";
import { ConnectionSyncStatus, OrgRole, Prisma, RepoIndexingStatus, StripeSubscriptionStatus, Org } from "@sourcebot/db";
import { ConnectionConfig } from "@sourcebot/schemas/v3/connection.type";
import { gerritSchema } from "@sourcebot/schemas/v3/gerrit.schema";
import { giteaSchema } from "@sourcebot/schemas/v3/gitea.schema";
import { githubSchema } from "@sourcebot/schemas/v3/github.schema";
import { gitlabSchema } from "@sourcebot/schemas/v3/gitlab.schema";
import Ajv from "ajv";
import { StatusCodes } from "http-status-codes";
import { cookies, headers } from "next/headers";
import { createTransport } from "nodemailer";
import { auth } from "./auth";
import { getConnection } from "./data/connection";
import { IS_BILLING_ENABLED } from "./ee/features/billing/stripe";
import InviteUserEmail from "./emails/inviteUserEmail";
import { MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, SINGLE_TENANT_ORG_DOMAIN, SOURCEBOT_GUEST_USER_ID, SOURCEBOT_SUPPORT_EMAIL } from "./lib/constants";
import { orgDomainSchema, orgNameSchema, repositoryQuerySchema } from "./lib/schemas";
import { TenancyMode } from "./lib/types";
import { decrementOrgSeatCount, getSubscriptionForOrg, incrementOrgSeatCount } from "./ee/features/billing/serverUtils";
import { bitbucketSchema } from "@sourcebot/schemas/v3/bitbucket.schema";
import { genericGitHostSchema } from "@sourcebot/schemas/v3/genericGitHost.schema";
import { getPlan, getSeats, SOURCEBOT_UNLIMITED_SEATS } from "./features/entitlements/server";
import { hasEntitlement } from "./features/entitlements/server";
import { getPublicAccessStatus } from "./ee/features/publicAccess/publicAccess";

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

export const withAuth = async <T>(fn: (userId: string) => Promise<T>, allowSingleTenantUnauthedAccess: boolean = false, apiKey: string | undefined = undefined) => {
    const session = await auth();

    if (!session) {
        // First we check if public access is enabled and supported. If not, then we check if an api key was provided. If not,
        // then this is an invalid unauthed request and we return a 401.
        const publicAccessEnabled = await getPublicAccessStatus(SINGLE_TENANT_ORG_DOMAIN);
        if (apiKey) {
            const prefix = getApiKeyPrefix(apiKey);

            const apiKeyDb = await prisma.apiKey.findFirst({
                where: {
                    prefix,
                },
            });

            if (!apiKeyDb) {
                console.error(`No API key found for prefix: ${prefix}`);
                return notAuthenticated();
            }

            const user = await prisma.user.findUnique({
                where: {
                    id: apiKeyDb.createdById,
                },
            });

            if (!user) {
                console.error(`No user found for API key: ${apiKey}`);
                return notAuthenticated();
            }

            return fn(user.id);
        } else if (
            env.SOURCEBOT_TENANCY_MODE === 'single' &&
            allowSingleTenantUnauthedAccess &&
            !isServiceError(publicAccessEnabled) &&
            publicAccessEnabled
        ) {
            if(!hasEntitlement("public-access")) {
                const plan = getPlan();
                console.error(`Public access isn't supported in your current plan: ${plan}. If you have a valid enterprise license key, pass it via SOURCEBOT_EE_LICENSE_KEY. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
                return notAuthenticated();
            }

            // To support unauthed access a guest user is created in initialize.ts, which we return here
            return fn(SOURCEBOT_GUEST_USER_ID);
        }
        return notAuthenticated();
    }
    return fn(session.user.id);
}

export const withOrgMembership = async <T>(userId: string, domain: string, fn: (params: { userRole: OrgRole, org: Org }) => Promise<T>, minRequiredRole: OrgRole = OrgRole.MEMBER) => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (!org) {
        return notFound("Organization not found");
    }

    const membership = await prisma.userToOrg.findUnique({
        where: {
            orgId_userId: {
                userId,
                orgId: org.id,
            }
        },
    });

    if (!membership) {
        return notFound("User not a member of this organization");
    }

    const getAuthorizationPrecendence = (role: OrgRole): number => {
        switch (role) {
            case OrgRole.GUEST:
                return 0;
            case OrgRole.MEMBER:
                return 1;
            case OrgRole.OWNER:
                return 2;
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
        org: org,
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
        withAuth(async (userId) => {
            const org = await prisma.org.create({
                data: {
                    name,
                    domain,
                    members: {
                        create: {
                            role: "OWNER",
                            user: {
                                connect: {
                                    id: userId,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const { success } = orgNameSchema.safeParse(name);
            if (!success) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: "Invalid organization url",
                } satisfies ServiceError;
            }

            await prisma.org.update({
                where: { id: org.id },
                data: { name },
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const updateOrgDomain = async (newDomain: string, existingDomain: string) => sew(() =>
    withTenancyModeEnforcement('multi', () =>
        withAuth((userId) =>
            withOrgMembership(userId, existingDomain, async ({ org }) => {
                const { success } = await orgDomainSchema.safeParseAsync(newDomain);
                if (!success) {
                    return {
                        statusCode: StatusCodes.BAD_REQUEST,
                        errorCode: ErrorCode.INVALID_REQUEST_BODY,
                        message: "Invalid organization url",
                    } satisfies ServiceError;
                }

                await prisma.org.update({
                    where: { id: org.id },
                    data: { domain: newDomain },
                });

                return {
                    success: true,
                }
            }, /* minRequiredRole = */ OrgRole.OWNER)
        )));

export const completeOnboarding = async (domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            // If billing is not enabled, we can just mark the org as onboarded.
            if (!IS_BILLING_ENABLED) {
                await prisma.org.update({
                    where: { id: org.id },
                    data: {
                        isOnboarded: true,
                    }
                });

                // Else, validate that the org has an active subscription.
            } else {
                const subscriptionOrError = await getSubscriptionForOrg(org.id, prisma);
                if (isServiceError(subscriptionOrError)) {
                    return subscriptionOrError;
                }

                await prisma.org.update({
                    where: { id: org.id },
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const secrets = await prisma.secret.findMany({
                where: {
                    orgId: org.id,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const encrypted = encrypt(value);
            const existingSecret = await prisma.secret.findUnique({
                where: {
                    orgId_key: {
                        orgId: org.id,
                        key,
                    }
                }
            });

            if (existingSecret) {
                return secretAlreadyExists();
            }

            await prisma.secret.create({
                data: {
                    orgId: org.id,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const secret = await prisma.secret.findUnique({
                where: {
                    orgId_key: {
                        orgId: org.id,
                        key,
                    }
                }
            });

            return !!secret;
        })));

export const deleteSecret = async (key: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            await prisma.secret.delete({
                where: {
                    orgId_key: {
                        orgId: org.id,
                        key,
                    }
                }
            });

            return {
                success: true,
            }
        })));

export const createApiKey = async (name: string, domain: string): Promise<{ key: string } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            try {
                const key = generateApiKey(userId);
                const prefix = getApiKeyPrefix(key);

                await prisma.apiKey.create({
                    data: {
                        name,
                        prefix,
                        orgId: org.id,
                        createdById: userId,
                    }
                });

                return {
                    key,
                }
            } catch (e) {
                return {
                    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                    errorCode: ErrorCode.API_KEY_ALREADY_EXISTS,
                    message: `Failed to create API key ${name} for user ${userId}`,
                } satisfies ServiceError;
            }
        })));

export const getUserApiKeys = async (domain: string): Promise<{ name: string; createdAt: Date; lastUsedAt: Date | null }[] | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const apiKeys = await prisma.apiKey.findMany({
                where: {
                    orgId: org.id,
                    createdById: userId,
                },
                orderBy: {
                    createdAt: 'desc',
                }
            });

            return apiKeys.map((apiKey) => ({
                name: apiKey.name,
                createdAt: apiKey.createdAt,
                lastUsedAt: apiKey.lastUsedAt,
            }));
        })));

export const getConnections = async (domain: string, filter: { status?: ConnectionSyncStatus[] } = {}) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connections = await prisma.connection.findMany({
                where: {
                    orgId: org.id,
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
        }), /* allowSingleTenantUnauthedAccess = */ true));

export const getConnectionInfo = async (connectionId: number, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connection = await prisma.connection.findUnique({
                where: {
                    id: connectionId,
                    orgId: org.id,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const repos = await prisma.repo.findMany({
                where: {
                    orgId: org.id,
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
                repoDisplayName: repo.displayName ?? undefined,
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

export const getRepoInfoByName = async (repoName: string, domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            // @note: repo names are represented by their remote url
            // on the code host. E.g.,:
            // - github.com/sourcebot-dev/sourcebot
            // - gitlab.com/gitlab-org/gitlab
            // - gerrit.wikimedia.org/r/mediawiki/extensions/OnionsPorFavor
            // etc.
            //
            // For most purposes, repo names are unique within an org, so using
            // findFirst is equivalent to findUnique. Duplicates _can_ occur when
            // a repository is specified by its remote url in a generic `git`
            // connection. For example:
            //
            // ```json
            // {
            //     "connections": {
            //         "connection-1": {
            //             "type": "github",
            //             "repos": [
            //                 "sourcebot-dev/sourcebot"
            //             ]
            //         },
            //         "connection-2": {
            //             "type": "git",
            //             "url": "file:///tmp/repos/sourcebot"
            //         }
            //     }
            // }
            // ```
            //
            // In this scenario, both repos will be named "github.com/sourcebot-dev/sourcebot".
            // We will leave this as an edge case for now since it's unlikely to happen in practice.
            //
            // @v4-todo: we could add a unique contraint on repo name + orgId to help de-duplicate
            // these cases.
            // @see: repoCompileUtils.ts
            const repo = await prisma.repo.findFirst({
                where: {
                    name: repoName,
                    orgId: org.id,
                },
            });

            if (!repo) {
                return notFound();
            }

            return {
                id: repo.id,
                name: repo.name,
                displayName: repo.displayName ?? undefined,
                codeHostType: repo.external_codeHostType,
                webUrl: repo.webUrl ?? undefined,
                imageUrl: repo.imageUrl ?? undefined,
                indexedAt: repo.indexedAt ?? undefined,
                repoIndexingStatus: repo.repoIndexingStatus,
            }
        }), /* allowSingleTenantUnauthedAccess = */ true));

export const createConnection = async (name: string, type: CodeHostType, connectionConfig: string, domain: string): Promise<{ id: number } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            if (env.CONFIG_PATH !== undefined) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.CONNECTION_CONFIG_PATH_SET,
                    message: "A configuration file has been provided. New connections cannot be added through the web interface.",
                } satisfies ServiceError;
            }

            const parsedConfig = parseConnectionConfig(connectionConfig);
            if (isServiceError(parsedConfig)) {
                return parsedConfig;
            }

            const existingConnectionWithName = await prisma.connection.findUnique({
                where: {
                    name_orgId: {
                        orgId: org.id,
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
                    orgId: org.id,
                    name,
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    connectionType: type,
                }
            });

            return {
                id: connection.id,
            }
        }, OrgRole.OWNER)
    ));

export const updateConnectionDisplayName = async (connectionId: number, name: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connection = await getConnection(connectionId, org.id);
            if (!connection) {
                return notFound();
            }

            const existingConnectionWithName = await prisma.connection.findUnique({
                where: {
                    name_orgId: {
                        orgId: org.id,
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
                    orgId: org.id,
                },
                data: {
                    name,
                }
            });

            return {
                success: true,
            }
        }, OrgRole.OWNER)
    ));

export const updateConnectionConfigAndScheduleSync = async (connectionId: number, config: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connection = await getConnection(connectionId, org.id);
            if (!connection) {
                return notFound();
            }

            const parsedConfig = parseConnectionConfig(config);
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
                    orgId: org.id,
                },
                data: {
                    config: parsedConfig as unknown as Prisma.InputJsonValue,
                    syncStatus: "SYNC_NEEDED",
                }
            });

            return {
                success: true,
            }
        }, OrgRole.OWNER)
    ));

export const flagConnectionForSync = async (connectionId: number, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connection = await getConnection(connectionId, org.id);
            if (!connection || connection.orgId !== org.id) {
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            await prisma.repo.updateMany({
                where: {
                    id: { in: repoIds },
                    orgId: org.id,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const connection = await getConnection(connectionId, org.id);
            if (!connection) {
                return notFound();
            }

            await prisma.connection.delete({
                where: {
                    id: connectionId,
                    orgId: org.id,
                }
            });

            return {
                success: true,
            }
        }, OrgRole.OWNER)
    ));

export const getCurrentUserRole = async (domain: string): Promise<OrgRole | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ userRole }) => {
            return userRole;
        }), /* allowSingleTenantUnauthedAccess = */ true)
    );

export const createInvites = async (emails: string[], domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {

            const seats = getSeats();
            const members = await getOrgMembers(domain);
            if (isServiceError(members)) {
                throw new ServiceErrorException(members);
            }

            if (seats !== SOURCEBOT_UNLIMITED_SEATS && members.length >= seats) {
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
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.INVALID_INVITE,
                    message: `One or more of the provided emails are already members of this org.`,
                } satisfies ServiceError;
            }

            await prisma.invite.createMany({
                data: emails.map((email) => ({
                    recipientEmail: email,
                    hostUserId: userId,
                    orgId: org.id,
                })),
                skipDuplicates: true,
            });

            // Send invites to recipients
            if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS) {
                const origin = (await headers()).get('origin')!;
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
                        from: env.EMAIL_FROM_ADDRESS,
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
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
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const getMe = async () => sew(() =>
    withAuth(async (userId) => {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
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
            await tx.userToOrg.create({
                data: {
                    userId: user.id,
                    orgId: invite.orgId,
                    role: "MEMBER",
                }
            });

            await tx.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    pendingApproval: false,
                }
            });

            await tx.invite.delete({
                where: {
                    id: invite.id,
                }
            });

            if (IS_BILLING_ENABLED) {
                const result = await incrementOrgSeatCount(invite.orgId, tx);
                if (isServiceError(result)) {
                    throw result;
                }
            }
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
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const currentUserId = userId;

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
                        orgId: org.id,
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
                            orgId: org.id,
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
                            orgId: org.id,
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
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const targetMember = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: memberId,
                    }
                }
            });

            if (!targetMember) {
                return notFound();
            }

            await prisma.$transaction(async (tx) => {
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
            });

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const leaveOrg = async (domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org, userRole }) => {
            if (userRole === OrgRole.OWNER) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.OWNER_CANNOT_LEAVE_ORG,
                    message: "Organization owners cannot leave their own organization",
                } satisfies ServiceError;
            }

            await prisma.$transaction(async (tx) => {
                await tx.userToOrg.delete({
                    where: {
                        orgId_userId: {
                            orgId: org.id,
                            userId: userId,
                        }
                    }
                });

                if (IS_BILLING_ENABLED) {
                    const result = await decrementOrgSeatCount(org.id, tx);
                    if (isServiceError(result)) {
                        throw result;
                    }
                }
            });

            return {
                success: true,
            }
        })
    ));

export const getOrgMembership = async (domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const membership = await prisma.userToOrg.findUnique({
                where: {
                    orgId_userId: {
                        orgId: org.id,
                        userId: userId,
                    }
                }
            });

            if (!membership) {
                return notFound();
            }

            return membership;
        })
    ));

export const getOrgMembers = async (domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const members = await prisma.userToOrg.findMany({
                where: {
                    orgId: org.id,
                    role: {
                        not: OrgRole.GUEST,
                    }
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
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
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
        })
    ));

export const getOrgAccountRequests = async (domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
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
            }));
        })
    ));

export const createAccountRequest = async (userId: string, domain: string) => sew(() =>
    withAuth(async (userId) => {
        const user = await prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            return notFound("User not found");
        }

        const org = await prisma.org.findUnique({
            where: {
                domain,
            },
        });
        
        if (!org) {
            return notFound("Organization not found");
        }

        const existingRequest = await prisma.accountRequest.findUnique({
            where: {
                requestedById_orgId: {
                    requestedById: userId,
                    orgId: org.id,
                },
            },
        });

        if (!existingRequest) {
            await prisma.accountRequest.create({
                data: {
                    requestedById: userId,
                    orgId: org.id,
                },
            });
        }

        return {
            success: true,
        }
    })
);


export const approveAccountRequest = async (requestId: string, domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const request = await prisma.accountRequest.findUnique({
                where: {
                    id: requestId,
                },
            });

            if (!request || request.orgId !== org.id) {
                return notFound();
            }


            const members = await getOrgMembers(domain);
            if (isServiceError(members)) {
                throw new ServiceErrorException(members);
            }

            const maxSeats = getSeats()
            const memberCount = members.length;

            if (memberCount >= maxSeats) {
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.ORG_SEAT_COUNT_REACHED,
                    message: "Organization is at max capacity",
                } satisfies ServiceError;
            }

            await prisma.$transaction([
                prisma.user.update({
                    where: {
                        id: request.requestedById,
                    },
                    data: {
                        pendingApproval: false,
                    },
                }),

                prisma.userToOrg.create({
                    data: {
                        userId: request.requestedById,
                        orgId: org.id,
                        role: "MEMBER",
                    },
                }),

                prisma.accountRequest.delete({
                    where: {
                        id: requestId,
                    },
                }),
            ]);

            return {
                success: true,
            }
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const rejectAccountRequest = async (requestId: string, domain: string) => sew(() =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
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
        }, /* minRequiredRole = */ OrgRole.OWNER)
    ));

export const dismissMobileUnsupportedSplashScreen = async () => sew(async () => {
    await cookies().set(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, 'true');
    return true;
});

export const getSearchContexts = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const searchContexts = await prisma.searchContext.findMany({
                where: {
                    orgId: org.id,
                },
            });

            return searchContexts.map((context) => ({
                name: context.name,
                description: context.description ?? undefined,
            }));
        }
        ), /* allowSingleTenantUnauthedAccess = */ true));


////// Helpers ///////

const parseConnectionConfig = (config: string) => {
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

    const connectionType = parsedConfig.type;
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
            case 'bitbucket':
                return bitbucketSchema;
            case 'git':
                return genericGitHostSchema;
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
        switch (connectionType) {
            case "gitea":
            case "github":
            case "bitbucket": {
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
            case "git": {
                return {
                    numRepos: 1,
                    hasToken: false,
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