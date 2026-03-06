'use server';

import { getAuditService } from "@/ee/features/audit/factory";
import { env } from "@sourcebot/shared";
import { addUserToOrganization, orgHasAvailability } from "@/lib/authUtils";
import { ErrorCode } from "@/lib/errorCodes";
import { notAuthenticated, notFound, orgNotFound, ServiceError, ServiceErrorException, unexpectedError } from "@/lib/serviceError";
import { getOrgMetadata, isHttpError, isServiceError } from "@/lib/utils";
import { prisma } from "@/prisma";
import { render } from "@react-email/components";
import * as Sentry from '@sentry/nextjs';
import { generateApiKey, getTokenFromConfig, hashSecret } from "@sourcebot/shared";
import { ApiKey, ConnectionSyncJobStatus, Org, OrgRole, Prisma, RepoIndexingJobStatus, RepoIndexingJobType, StripeSubscriptionStatus } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { getPlan, hasEntitlement } from "@sourcebot/shared";
import { StatusCodes } from "http-status-codes";
import { cookies } from "next/headers";
import { createTransport } from "nodemailer";
import { Octokit } from "octokit";
import { auth } from "./auth";
import { getOrgFromDomain } from "./data/org";
import { decrementOrgSeatCount, getSubscriptionForOrg } from "./ee/features/billing/serverUtils";
import { IS_BILLING_ENABLED } from "./ee/features/billing/stripe";
import InviteUserEmail from "./emails/inviteUserEmail";
import JoinRequestApprovedEmail from "./emails/joinRequestApprovedEmail";
import JoinRequestSubmittedEmail from "./emails/joinRequestSubmittedEmail";
import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, SINGLE_TENANT_ORG_DOMAIN, SOURCEBOT_GUEST_USER_ID, SOURCEBOT_SUPPORT_EMAIL } from "./lib/constants";
import { orgDomainSchema, orgNameSchema } from "./lib/schemas";
import { ApiKeyPayload, RepositoryQuery, TenancyMode } from "./lib/types";
import { withAuthV2, withOptionalAuthV2 } from "./withAuthV2";
import { getBrowsePath } from "./app/[domain]/browse/hooks/utils";

const logger = createLogger('web-actions');
const auditService = getAuditService();

/**
 * "Service Error Wrapper".
 * 
 * Captures any thrown exceptions, logs them to the console and Sentry,
 * and returns a generic unexpected service error.
 */
export const sew = async <T>(fn: () => Promise<T>): Promise<T | ServiceError> => {
    try {
        return await fn();
    } catch (e) {
        Sentry.captureException(e);
        logger.error(e);

        if (e instanceof ServiceErrorException) {
            return e.serviceError;
        }

        return unexpectedError(`An unexpected error occurred. Please try again later.`);
    }
}

export const withAuth = async <T>(fn: (userId: string, apiKeyHash: string | undefined) => Promise<T>, allowAnonymousAccess: boolean = false, apiKey: ApiKeyPayload | undefined = undefined) => {
    const session = await auth();

    if (!session) {
        // First we check if public access is enabled and supported. If not, then we check if an api key was provided. If not,
        // then this is an invalid unauthed request and we return a 401.
        const anonymousAccessEnabled = await getAnonymousAccessStatus(SINGLE_TENANT_ORG_DOMAIN);
        if (apiKey) {
            const apiKeyOrError = await verifyApiKey(apiKey);
            if (isServiceError(apiKeyOrError)) {
                logger.error(`Invalid API key: ${JSON.stringify(apiKey)}. Error: ${JSON.stringify(apiKeyOrError)}`);
                return notAuthenticated();
            }

            const user = await prisma.user.findUnique({
                where: {
                    id: apiKeyOrError.apiKey.createdById,
                },
            });

            if (!user) {
                logger.error(`No user found for API key: ${apiKey}`);
                return notAuthenticated();
            }

            await prisma.apiKey.update({
                where: {
                    hash: apiKeyOrError.apiKey.hash,
                },
                data: {
                    lastUsedAt: new Date(),
                },
            });

            return fn(user.id, apiKeyOrError.apiKey.hash);
        } else if (
            allowAnonymousAccess &&
            !isServiceError(anonymousAccessEnabled) &&
            anonymousAccessEnabled
        ) {
            if (!hasEntitlement("anonymous-access")) {
                const plan = getPlan();
                logger.error(`Anonymous access isn't supported in your current plan: ${plan}. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
                return notAuthenticated();
            }

            // To support anonymous access a guest user is created in initialize.ts, which we return here
            return fn(SOURCEBOT_GUEST_USER_ID, undefined);
        }
        return notAuthenticated();
    }
    return fn(session.user.id, undefined);
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

    const getAuthorizationPrecedence = (role: OrgRole): number => {
        switch (role) {
            case OrgRole.GUEST:
                return 0;
            case OrgRole.MEMBER:
                return 1;
            case OrgRole.OWNER:
                return 2;
        }
    }


    if (getAuthorizationPrecedence(membership.role) < getAuthorizationPrecedence(minRequiredRole)) {
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

export const verifyApiKey = async (apiKeyPayload: ApiKeyPayload): Promise<{ apiKey: ApiKey } | ServiceError> => sew(async () => {
    const parts = apiKeyPayload.apiKey.split("-");
    if (parts.length !== 2 || parts[0] !== "sourcebot") {
        return {
            statusCode: StatusCodes.BAD_REQUEST,
            errorCode: ErrorCode.INVALID_API_KEY,
            message: "Invalid API key",
        } satisfies ServiceError;
    }

    const hash = hashSecret(parts[1])
    const apiKey = await prisma.apiKey.findUnique({
        where: {
            hash,
        },
    });

    if (!apiKey) {
        return {
            statusCode: StatusCodes.UNAUTHORIZED,
            errorCode: ErrorCode.INVALID_API_KEY,
            message: "Invalid API key",
        } satisfies ServiceError;
    }

    const apiKeyTargetOrg = await prisma.org.findUnique({
        where: {
            domain: apiKeyPayload.domain,
        },
    });

    if (!apiKeyTargetOrg) {
        return {
            statusCode: StatusCodes.UNAUTHORIZED,
            errorCode: ErrorCode.INVALID_API_KEY,
            message: `Invalid API key payload. Provided domain ${apiKeyPayload.domain} does not exist.`,
        } satisfies ServiceError;
    }

    if (apiKey.orgId !== apiKeyTargetOrg.id) {
        return {
            statusCode: StatusCodes.UNAUTHORIZED,
            errorCode: ErrorCode.INVALID_API_KEY,
            message: `Invalid API key payload. Provided domain ${apiKeyPayload.domain} does not match the API key's org.`,
        } satisfies ServiceError;
    }

    return {
        apiKey,
    }
});


export const createApiKey = async (name: string, domain: string): Promise<{ key: string } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org, userRole }) => {
            if (env.EXPERIMENT_DISABLE_API_KEY_CREATION_FOR_NON_ADMIN_USERS === 'true' && userRole !== OrgRole.OWNER) {
               logger.error(`API key creation is disabled for non-admin users. User ${userId} is not an owner.`);
               return {
                statusCode: StatusCodes.FORBIDDEN,
                errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                message: "API key creation is disabled for non-admin users.",
               } satisfies ServiceError;
            }

            const existingApiKey = await prisma.apiKey.findFirst({
                where: {
                    createdById: userId,
                    name,
                },
            });

            if (existingApiKey) {
                await auditService.createAudit({
                    action: "api_key.creation_failed",
                    actor: {
                        id: userId,
                        type: "user"
                    },
                    target: {
                        id: org.id.toString(),
                        type: "org"
                    },
                    orgId: org.id,
                    metadata: {
                        message: `API key ${name} already exists`,
                        api_key: name
                    }
                });
                return {
                    statusCode: StatusCodes.BAD_REQUEST,
                    errorCode: ErrorCode.API_KEY_ALREADY_EXISTS,
                    message: `API key ${name} already exists`,
                } satisfies ServiceError;
            }

            const { key, hash } = generateApiKey();
            const apiKey = await prisma.apiKey.create({
                data: {
                    name,
                    hash,
                    orgId: org.id,
                    createdById: userId,
                }
            });

            await auditService.createAudit({
                action: "api_key.created",
                actor: {
                    id: userId,
                    type: "user"
                },
                target: {
                    id: apiKey.hash,
                    type: "api_key"
                },
                orgId: org.id
            });

            return {
                key,
            }
        })));

export const deleteApiKey = async (name: string, domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const apiKey = await prisma.apiKey.findFirst({
                where: {
                    name,
                    createdById: userId,
                },
            });

            if (!apiKey) {
                await auditService.createAudit({
                    action: "api_key.deletion_failed",
                    actor: {
                        id: userId,
                        type: "user"
                    },
                    target: {
                        id: domain,
                        type: "org"
                    },
                    orgId: org.id,
                    metadata: {
                        message: `API key ${name} not found for user ${userId}`,
                        api_key: name
                    }
                });
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.API_KEY_NOT_FOUND,
                    message: `API key ${name} not found for user ${userId}`,
                } satisfies ServiceError;
            }

            await prisma.apiKey.delete({
                where: {
                    hash: apiKey.hash,
                },
            });

            await auditService.createAudit({
                action: "api_key.deleted",
                actor: {
                    id: userId,
                    type: "user"
                },
                target: {
                    id: apiKey.hash,
                    type: "api_key"
                },
                orgId: org.id,
                metadata: {
                    api_key: name
                }
            });

            return {
                success: true,
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

export const getRepos = async ({
    where,
    take,
}: {
    where?: Prisma.RepoWhereInput,
    take?: number
} = {}) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const repos = await prisma.repo.findMany({
            where: {
                orgId: org.id,
                ...where,
            },
            take,
        });
        
        const baseUrl = env.AUTH_URL;

        return repos.map((repo) => ({
            codeHostType: repo.external_codeHostType,
            repoId: repo.id,
            repoName: repo.name,
            repoDisplayName: repo.displayName ?? undefined,
            webUrl: `${baseUrl}${getBrowsePath({
                repoName: repo.name,
                path: '',
                pathType: 'tree',
                domain: org.domain,
            })}`,
            externalWebUrl: repo.webUrl ?? undefined,
            imageUrl: repo.imageUrl ?? undefined,
            indexedAt: repo.indexedAt ?? undefined,
            pushedAt: repo.pushedAt ?? undefined,
            defaultBranch: repo.defaultBranch ?? undefined,
            isFork: repo.isFork,
            isArchived: repo.isArchived,
        } satisfies RepositoryQuery))
    }));

/**
 * Returns a set of aggregated stats about the repos in the org
 */
export const getReposStats = async () => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        const [
            // Total number of repos.
            numberOfRepos,
            // Number of repos with their first time indexing jobs either
            // pending or in progress.
            numberOfReposWithFirstTimeIndexingJobsInProgress,
            // Number of repos that have been indexed at least once.
            numberOfReposWithIndex,
        ] = await Promise.all([
            prisma.repo.count({
                where: {
                    orgId: org.id,
                }
            }),
            prisma.repo.count({
                where: {
                    orgId: org.id,
                    indexedAt: null,
                    jobs: {
                        some: {
                            type: RepoIndexingJobType.INDEX,
                            status: {
                                in: [
                                    RepoIndexingJobStatus.PENDING,
                                    RepoIndexingJobStatus.IN_PROGRESS,
                                ]
                            }
                        },
                    },
                }
            }),
            prisma.repo.count({
                where: {
                    orgId: org.id,
                    NOT: {
                        indexedAt: null,
                    }
                }
            })
        ]);

        return {
            numberOfRepos,
            numberOfReposWithFirstTimeIndexingJobsInProgress,
            numberOfReposWithIndex,
        };
    })
)

export const getConnectionStats = async () => sew(() =>
    withAuthV2(async ({ org, prisma }) => {
        const [
            numberOfConnections,
            numberOfConnectionsWithFirstTimeSyncJobsInProgress,
        ] = await Promise.all([
            prisma.connection.count({
                where: {
                    orgId: org.id,
                }
            }),
            prisma.connection.count({
                where: {
                    orgId: org.id,
                    syncedAt: null,
                    syncJobs: {
                        some: {
                            status: {
                                in: [
                                    ConnectionSyncJobStatus.PENDING,
                                    ConnectionSyncJobStatus.IN_PROGRESS,
                                ]
                            }
                        }
                    }
                }
            })
        ]);

        return {
            numberOfConnections,
            numberOfConnectionsWithFirstTimeSyncJobsInProgress,
        };
    })
);

export const getRepoInfoByName = async (repoName: string) => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
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
        // @v4-todo: we could add a unique constraint on repo name + orgId to help de-duplicate
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
            externalWebUrl: repo.webUrl ?? undefined,
            imageUrl: repo.imageUrl ?? undefined,
            indexedAt: repo.indexedAt ?? undefined,
        }
    }));

export const experimental_addGithubRepositoryByUrl = async (repositoryUrl: string): Promise<{ connectionId: number } | ServiceError> => sew(() =>
    withOptionalAuthV2(async ({ org, prisma }) => {
        if (env.EXPERIMENT_SELF_SERVE_REPO_INDEXING_ENABLED !== 'true') {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "This feature is not enabled.",
            } satisfies ServiceError;
        }

        // Parse repository URL to extract owner/repo
        const repoInfo = (() => {
            const url = repositoryUrl.trim();

            // Handle various GitHub URL formats
            const patterns = [
                // https://github.com/owner/repo or https://github.com/owner/repo.git
                /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/,
                // github.com/owner/repo
                /^github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?\/?$/,
                // owner/repo
                /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) {
                    return {
                        owner: match[1],
                        repo: match[2]
                    };
                }
            }

            return null;
        })();

        if (!repoInfo) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "Invalid repository URL format. Please use 'owner/repo' or 'https://github.com/owner/repo' format.",
            } satisfies ServiceError;
        }

        const { owner, repo } = repoInfo;

        // Use GitHub API to fetch repository information and get the external_id
        const octokit = new Octokit({
            auth: env.EXPERIMENT_SELF_SERVE_REPO_INDEXING_GITHUB_TOKEN
        });

        let githubRepo;
        try {
            const response = await octokit.rest.repos.get({
                owner,
                repo,
            });
            githubRepo = response.data;
        } catch (error) {
            if (isHttpError(error, 404)) {
                return {
                    statusCode: StatusCodes.NOT_FOUND,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Repository '${owner}/${repo}' not found or is private. Only public repositories can be added.`,
                } satisfies ServiceError;
            }

            if (isHttpError(error, 403)) {
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INVALID_REQUEST_BODY,
                    message: `Access to repository '${owner}/${repo}' is forbidden. Only public repositories can be added.`,
                } satisfies ServiceError;
            }

            return {
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: `Failed to fetch repository information: ${error instanceof Error ? error.message : 'Unknown error'}`,
            } satisfies ServiceError;
        }

        if (githubRepo.private) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.INVALID_REQUEST_BODY,
                message: "Only public repositories can be added.",
            } satisfies ServiceError;
        }

        // Check if this repository is already connected using the external_id
        const existingRepo = await prisma.repo.findFirst({
            where: {
                orgId: org.id,
                external_id: githubRepo.id.toString(),
                external_codeHostType: 'github',
                external_codeHostUrl: 'https://github.com',
            }
        });

        if (existingRepo) {
            return {
                statusCode: StatusCodes.BAD_REQUEST,
                errorCode: ErrorCode.CONNECTION_ALREADY_EXISTS,
                message: "This repository already exists.",
            } satisfies ServiceError;
        }

        const connectionName = `${owner}-${repo}-${Date.now()}`;

        // Create GitHub connection config
        const connectionConfig: GithubConnectionConfig = {
            type: "github" as const,
            repos: [`${owner}/${repo}`],
            ...(env.EXPERIMENT_SELF_SERVE_REPO_INDEXING_GITHUB_TOKEN ? {
                token: {
                    env: 'EXPERIMENT_SELF_SERVE_REPO_INDEXING_GITHUB_TOKEN'
                }
            } : {})
        };

        const connection = await prisma.connection.create({
            data: {
                orgId: org.id,
                name: connectionName,
                config: connectionConfig as unknown as Prisma.InputJsonValue,
                connectionType: 'github',
            }
        });

        return {
            connectionId: connection.id,
        }
    }));

export const getCurrentUserRole = async (domain: string): Promise<OrgRole | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ userRole }) => {
            return userRole;
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowAnonymousAccess = */ true
    ));

export const createInvites = async (emails: string[], domain: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const failAuditCallback = async (error: string) => {
                await auditService.createAudit({
                    action: "user.invite_failed",
                    actor: {
                        id: userId,
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
            const user = await getMe();
            if (isServiceError(user)) {
                throw new ServiceErrorException(user);
            }

            const hasAvailability = await orgHasAvailability(domain);
            if (!hasAvailability) {
                await auditService.createAudit({
                    action: "user.invite_failed",
                    actor: {
                        id: userId,
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
                    hostUserId: userId,
                    orgId: org.id,
                })),
                skipDuplicates: true,
            });

            // Send invites to recipients
            if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS) {
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
                    const transport = createTransport(env.SMTP_CONNECTION_URL);
                    const html = await render(InviteUserEmail({
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

            await auditService.createAudit({
                action: "user.invites_created",
                actor: {
                    id: userId,
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
            image: user.image,
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
        }


        const hasAvailability = await orgHasAvailability(invite.org.domain);
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

            const failAuditCallback = async (error: string) => {
                await auditService.createAudit({
                    action: "org.ownership_transfer_failed",
                    actor: {
                        id: currentUserId,
                        type: "user"
                    },
                    target: {
                        id: org.id.toString(),
                        type: "org"
                    },
                    orgId: org.id,
                    metadata: {
                        message: error
                    }
                })
            }
            if (newOwnerId === currentUserId) {
                await failAuditCallback("User is already the owner of this org");
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
                await failAuditCallback("The user you're trying to make the owner doesn't exist");
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

            await auditService.createAudit({
                action: "org.ownership_transferred",
                actor: {
                    id: currentUserId,
                    type: "user"
                },
                target: {
                    id: org.id.toString(),
                    type: "org"
                },
                orgId: org.id,
                metadata: {
                    message: `Ownership transferred from ${currentUserId} to ${newOwnerId}`
                }
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

export const createAccountRequest = async (userId: string, domain: string) => sew(async () => {
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

    if (existingRequest) {
        logger.warn(`User ${userId} already has an account request for org ${org.id}. Skipping account request creation.`);
        return {
            success: true,
            existingRequest: true,
        }
    }

    if (!existingRequest) {
        await prisma.accountRequest.create({
            data: {
                requestedById: userId,
                orgId: org.id,
            },
        });

        if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS) {
            // TODO: This is needed because we can't fetch the origin from the request headers when this is called
            // on user creation (the header isn't set when next-auth calls onCreateUser for some reason)
            const deploymentUrl = env.AUTH_URL;

            const owner = await prisma.user.findFirst({
                where: {
                    orgs: {
                        some: {
                            orgId: org.id,
                            role: "OWNER",
                        },
                    },
                },
            });

            if (!owner) {
                logger.error(`Failed to find owner for org ${org.id} when drafting email for account request from ${userId}`);
            } else {
                const html = await render(JoinRequestSubmittedEmail({
                    baseUrl: deploymentUrl,
                    requestor: {
                        name: user.name ?? undefined,
                        email: user.email!,
                        avatarUrl: user.image ?? undefined,
                    },
                    orgName: org.name,
                    orgDomain: org.domain,
                    orgImageUrl: org.imageUrl ?? undefined,
                }));

                const transport = createTransport(env.SMTP_CONNECTION_URL);
                const result = await transport.sendMail({
                    to: owner.email!,
                    from: env.EMAIL_FROM_ADDRESS,
                    subject: `New account request for ${org.name} on Sourcebot`,
                    html,
                    text: `New account request for ${org.name} on Sourcebot by ${user.name ?? user.email}`,
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length > 0) {
                    logger.error(`Failed to send account request email to ${owner.email}: ${failed}`);
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

export const getMemberApprovalRequired = async (domain: string): Promise<boolean | ServiceError> => sew(async () => {
    const org = await prisma.org.findUnique({
        where: {
            domain,
        },
    });

    if (!org) {
        return orgNotFound();
    }

    return org.memberApprovalRequired;
});

export const setMemberApprovalRequired = async (domain: string, required: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            await prisma.org.update({
                where: { id: org.id },
                data: { memberApprovalRequired: required },
            });

            return {
                success: true,
            };
        }, /* minRequiredRole = */ OrgRole.OWNER)
    )
);

export const setInviteLinkEnabled = async (domain: string, enabled: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            await prisma.org.update({
                where: { id: org.id },
                data: { inviteLinkEnabled: enabled },
            });

            return {
                success: true,
            };
        }, /* minRequiredRole = */ OrgRole.OWNER)
    )
);

export const approveAccountRequest = async (requestId: string, domain: string) => sew(async () =>
    withAuth(async (userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const failAuditCallback = async (error: string) => {
                await auditService.createAudit({
                    action: "user.join_request_approve_failed",
                    actor: {
                        id: userId,
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
            if (env.SMTP_CONNECTION_URL && env.EMAIL_FROM_ADDRESS) {
                const html = await render(JoinRequestApprovedEmail({
                    baseUrl: env.AUTH_URL,
                    user: {
                        name: request.requestedBy.name ?? undefined,
                        email: request.requestedBy.email!,
                        avatarUrl: request.requestedBy.image ?? undefined,
                    },
                    orgName: org.name,
                    orgDomain: org.domain
                }));

                const transport = createTransport(env.SMTP_CONNECTION_URL);
                const result = await transport.sendMail({
                    to: request.requestedBy.email!,
                    from: env.EMAIL_FROM_ADDRESS,
                    subject: `Your request to join ${org.name} has been approved`,
                    html,
                    text: `Your request to join ${org.name} on Sourcebot has been approved. You can now access the organization at ${origin}/${org.domain}`,
                });

                const failed = result.rejected.concat(result.pending).filter(Boolean);
                if (failed.length > 0) {
                    logger.error(`Failed to send approval email to ${request.requestedBy.email}: ${failed}`);
                }
            } else {
                logger.warn(`SMTP_CONNECTION_URL or EMAIL_FROM_ADDRESS not set. Skipping approval email to ${request.requestedBy.email}`);
            }

            await auditService.createAudit({
                action: "user.join_request_approved",
                actor: {
                    id: userId,
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


export const getSearchContexts = async (domain: string) => sew(() =>
    withAuth((userId) =>
        withOrgMembership(userId, domain, async ({ org }) => {
            const searchContexts = await prisma.searchContext.findMany({
                where: {
                    orgId: org.id,
                },
                include: {
                    repos: true,
                },
            });

            return searchContexts.map((context) => ({
                id: context.id,
                name: context.name,
                description: context.description ?? undefined,
                repoNames: context.repos.map((repo) => repo.name),
            }));
        }, /* minRequiredRole = */ OrgRole.GUEST), /* allowAnonymousAccess = */ true
    ));

export const getRepoImage = async (repoId: number): Promise<ArrayBuffer | ServiceError> => sew(async () => {
    return await withOptionalAuthV2(async ({ org, prisma }) => {
        const repo = await prisma.repo.findUnique({
            where: {
                id: repoId,
                orgId: org.id,
            },
            include: {
                connections: {
                    include: {
                        connection: true,
                    }
                }
            },
        });

        if (!repo || !repo.imageUrl) {
            return notFound();
        }

        const authHeaders: Record<string, string> = {};
        for (const { connection } of repo.connections) {
            try {
                if (connection.connectionType === 'github') {
                    const config = connection.config as unknown as GithubConnectionConfig;
                    if (config.token) {
                        const token = await getTokenFromConfig(config.token);
                        authHeaders['Authorization'] = `token ${token}`;
                        break;
                    }
                } else if (connection.connectionType === 'gitlab') {
                    const config = connection.config as unknown as GitlabConnectionConfig;
                    if (config.token) {
                        const token = await getTokenFromConfig(config.token);
                        authHeaders['PRIVATE-TOKEN'] = token;
                        break;
                    }
                } else if (connection.connectionType === 'gitea') {
                    const config = connection.config as unknown as GiteaConnectionConfig;
                    if (config.token) {
                        const token = await getTokenFromConfig(config.token);
                        authHeaders['Authorization'] = `token ${token}`;
                        break;
                    }
                }
            } catch (error) {
                logger.warn(`Failed to get token for connection ${connection.id}:`, error);
            }
        }

        try {
            const response = await fetch(repo.imageUrl, {
                headers: authHeaders,
            });

            if (!response.ok) {
                logger.warn(`Failed to fetch image from ${repo.imageUrl}: ${response.status}`);
                return notFound();
            }

            const imageBuffer = await response.arrayBuffer();
            return imageBuffer;
        } catch (error) {
            logger.error(`Error proxying image for repo ${repoId}:`, error);
            return notFound();
        }
    })
});

export const getAnonymousAccessStatus = async (domain: string): Promise<boolean | ServiceError> => sew(async () => {
    const org = await getOrgFromDomain(domain);
    if (!org) {
        return {
            statusCode: StatusCodes.NOT_FOUND,
            errorCode: ErrorCode.NOT_FOUND,
            message: "Organization not found",
        } satisfies ServiceError;
    }

    // If no metadata is set we don't try to parse it since it'll result in a parse error
    if (org.metadata === null) {
        return false;
    }

    const orgMetadata = getOrgMetadata(org);
    if (!orgMetadata) {
        return {
            statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
            errorCode: ErrorCode.INVALID_ORG_METADATA,
            message: "Invalid organization metadata",
        } satisfies ServiceError;
    }

    return !!orgMetadata.anonymousAccessEnabled;
});

export const setAnonymousAccessStatus = async (domain: string, enabled: boolean): Promise<ServiceError | boolean> => sew(async () => {
    return await withAuth(async (userId) => {
        return await withOrgMembership(userId, domain, async ({ org }) => {
            const hasAnonymousAccessEntitlement = hasEntitlement("anonymous-access");
            if (!hasAnonymousAccessEntitlement) {
                const plan = getPlan();
                console.error(`Anonymous access isn't supported in your current plan: ${plan}. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
                return {
                    statusCode: StatusCodes.FORBIDDEN,
                    errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
                    message: "Anonymous access is not supported in your current plan",
                } satisfies ServiceError;
            }

            const currentMetadata = getOrgMetadata(org);
            const mergedMetadata = {
                ...(currentMetadata ?? {}),
                anonymousAccessEnabled: enabled,
            };

            await prisma.org.update({
                where: {
                    id: org.id,
                },
                data: {
                    metadata: mergedMetadata,
                },
            });

            return true;
        }, /* minRequiredRole = */ OrgRole.OWNER);
    });
});

export const setAgenticSearchTutorialDismissedCookie = async (dismissed: boolean) => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, dismissed ? "true" : "false", {
        httpOnly: false, // Allow client-side access
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
    });
    return true;
});

export const dismissMobileUnsupportedSplashScreen = async () => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, 'true');
    return true;
});
