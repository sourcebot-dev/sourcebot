'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { env, getSMTPConnectionURL } from "@sourcebot/shared";
import { addUserToOrganization, orgHasAvailability } from "@/lib/authUtils";
import { ErrorCode } from "@/lib/errorCodes";
import { notAuthenticated, notFound, orgNotFound, ServiceError } from "@/lib/serviceError";
import { getOrgMetadata, isHttpError, isServiceError } from "@/lib/utils";
import { __unsafePrisma } from "@/prisma";
import { render } from "@react-email/components";
import { generateApiKey, getTokenFromConfig } from "@sourcebot/shared";
import { ConnectionSyncJobStatus, OrgRole, Prisma, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { hasEntitlement } from "@/lib/entitlements";
import { StatusCodes } from "http-status-codes";
import { cookies } from "next/headers";
import { createTransport } from "nodemailer";
import { Octokit } from "octokit";
import InviteUserEmail from "./emails/inviteUserEmail";
import JoinRequestApprovedEmail from "./emails/joinRequestApprovedEmail";
import JoinRequestSubmittedEmail from "./emails/joinRequestSubmittedEmail";
import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, SINGLE_TENANT_ORG_ID, SOURCEBOT_SUPPORT_EMAIL } from "./lib/constants";
import { RepositoryQuery } from "./lib/types";
import { getAuthenticatedUser, withAuth, withOptionalAuth } from "./middleware/withAuth";
import { withMinimumOrgRole } from "./middleware/withMinimumOrgRole";
import { getBrowsePath } from "./app/(app)/browse/hooks/utils";
import { sew } from "@/middleware/sew";

const logger = createLogger('web-actions');

////// Actions ///////
export const completeOnboarding = async (): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, prisma }) => {
        await prisma.org.update({
            where: { id: org.id },
            data: {
                isOnboarded: true,
            }
        });

        return {
            success: true,
        }
    }));

export const createApiKey = async (name: string): Promise<{ key: string } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, role, prisma }) => {
        if ((env.DISABLE_API_KEY_CREATION_FOR_NON_OWNER_USERS === 'true' || env.DISABLE_API_KEY_USAGE_FOR_NON_OWNER_USERS === 'true') && role !== OrgRole.OWNER) {
           logger.error(`API key creation is disabled for non-admin users. User ${user.id} is not an owner.`);
           return {
            statusCode: StatusCodes.FORBIDDEN,
            errorCode: ErrorCode.INSUFFICIENT_PERMISSIONS,
            message: "API key creation is disabled for non-admin users.",
           } satisfies ServiceError;
        }

        const existingApiKey = await prisma.apiKey.findFirst({
            where: {
                createdById: user.id,
                name,
            },
        });

        if (existingApiKey) {
            await createAudit({
                action: "api_key.creation_failed",
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
                createdById: user.id,
            }
        });

        await createAudit({
            action: "api_key.created",
            actor: {
                id: user.id,
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
    }));

export const deleteApiKey = async (name: string): Promise<{ success: boolean } | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const apiKey = await prisma.apiKey.findFirst({
            where: {
                name,
                createdById: user.id,
            },
        });

        if (!apiKey) {
            await createAudit({
                action: "api_key.deletion_failed",
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
                    message: `API key ${name} not found for user ${user.id}`,
                    api_key: name
                }
            });
            return {
                statusCode: StatusCodes.NOT_FOUND,
                errorCode: ErrorCode.API_KEY_NOT_FOUND,
                message: `API key ${name} not found for user ${user.id}`,
            } satisfies ServiceError;
        }

        await prisma.apiKey.delete({
            where: {
                hash: apiKey.hash,
            },
        });

        await createAudit({
            action: "api_key.deleted",
            actor: {
                id: user.id,
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
    }));

export const getUserApiKeys = async (): Promise<{ name: string; createdAt: Date; lastUsedAt: Date | null }[] | ServiceError> => sew(() =>
    withAuth(async ({ org, user, prisma }) => {
        const apiKeys = await prisma.apiKey.findMany({
            where: {
                orgId: org.id,
                createdById: user.id,
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
    }));

export const getRepos = async ({
    where,
    take,
}: {
    where?: Prisma.RepoWhereInput,
    take?: number
} = {}) => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
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
    withOptionalAuth(async ({ org, prisma }) => {
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
    withAuth(async ({ org, prisma }) => {
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
    withOptionalAuth(async ({ org, prisma }) => {
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
    withOptionalAuth(async ({ org, prisma }) => {
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

export const getCurrentUserRole = async (): Promise<OrgRole | ServiceError> => sew(() =>
    withOptionalAuth(async ({ role }) => {
        return role;
    }));

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

export const getMe = async () => sew(() =>
    withAuth(async ({ user, prisma }) => {
        const userWithOrgs = await prisma.user.findUnique({
            where: {
                id: user.id,
            },
            include: {
                orgs: {
                    include: {
                        org: true,
                    }
                },
            }
        });

        if (!userWithOrgs) {
            return notFound();
        }

        return {
            id: userWithOrgs.id,
            email: userWithOrgs.email,
            name: userWithOrgs.name,
            image: userWithOrgs.image,
            memberships: userWithOrgs.orgs.map((org) => ({
                id: org.orgId,
                role: org.role,
                name: org.org.name,
            }))
        }
    }));

export const getOrgMembers = async () => sew(() =>
    withAuth(async ({ org, prisma }) => {
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
    }));

export const getOrgInvites = async () => sew(() =>
    withAuth(async ({ org, prisma }) => {
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
    }));

export const getOrgAccountRequests = async () => sew(() =>
    withAuth(async ({ org, prisma }) => {
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
    }));

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
                        email: user.email!,
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

export const getMemberApprovalRequired = async (): Promise<boolean | ServiceError> => sew(async () => {
    const org = await __unsafePrisma.org.findUnique({
        where: {
            id: SINGLE_TENANT_ORG_ID,
        },
    });

    if (!org) {
        return orgNotFound();
    }

    return org.memberApprovalRequired;
});

export const setMemberApprovalRequired = async (required: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            await prisma.org.update({
                where: { id: org.id },
                data: { memberApprovalRequired: required },
            });

            return {
                success: true,
            };
        })
    )
);

export const setInviteLinkEnabled = async (enabled: boolean): Promise<{ success: boolean } | ServiceError> => sew(async () =>
    withAuth(async ({ org, role, prisma }) =>
        withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            await prisma.org.update({
                where: { id: org.id },
                data: { inviteLinkEnabled: enabled },
            });

            return {
                success: true,
            };
        })
    )
);

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


export const getSearchContexts = async () => sew(() =>
    withOptionalAuth(async ({ org, prisma }) => {
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
    }));

export const getRepoImage = async (repoId: number): Promise<ArrayBuffer | ServiceError> => sew(async () => {
    return await withOptionalAuth(async ({ org, prisma }) => {
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

export const getAnonymousAccessStatus = async (): Promise<boolean | ServiceError> => sew(async () => {
    const org = await __unsafePrisma.org.findUnique({
        where: { id: SINGLE_TENANT_ORG_ID },
    });
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

export const setAnonymousAccessStatus = async (enabled: boolean): Promise<ServiceError | boolean> => sew(async () => {
    return await withAuth(async ({ org, role, prisma }) => {
        return await withMinimumOrgRole(role, OrgRole.OWNER, async () => {
            const hasAnonymousAccessEntitlement = await hasEntitlement("anonymous-access");
            if (!hasAnonymousAccessEntitlement) {
                console.error(`Anonymous access isn't supported in your current plan. For support, contact ${SOURCEBOT_SUPPORT_EMAIL}.`);
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
        });
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
