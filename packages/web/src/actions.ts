'use server';

import { createAudit } from "@/ee/features/audit/audit";
import { env, getSMTPConnectionURL } from "@sourcebot/shared";
import { ErrorCode } from "@/lib/errorCodes";
import { notAuthenticated, notFound, ServiceError } from "@/lib/serviceError";
import { __unsafePrisma } from "@/prisma";
import { render } from "@react-email/components";
import { generateApiKey, getTokenFromConfig } from "@sourcebot/shared";
import { ConnectionSyncJobStatus, OrgRole, Prisma, RepoIndexingJobStatus, RepoIndexingJobType } from "@sourcebot/db";
import { createLogger } from "@sourcebot/shared";
import { GiteaConnectionConfig } from "@sourcebot/schemas/v3/gitea.type";
import { GithubConnectionConfig } from "@sourcebot/schemas/v3/github.type";
import { GitlabConnectionConfig } from "@sourcebot/schemas/v3/gitlab.type";
import { StatusCodes } from "http-status-codes";
import { cookies } from "next/headers";
import { createTransport } from "nodemailer";
import JoinRequestSubmittedEmail from "./emails/joinRequestSubmittedEmail";
import { AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, SINGLE_TENANT_ORG_ID } from "./lib/constants";
import { RepositoryQuery } from "./lib/types";
import { getAuthenticatedUser, withAuth, withOptionalAuth } from "./middleware/withAuth";
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

// eslint-disable-next-line authz/require-auth-wrapper -- UI-only preference cookie, no DB access
export const setAgenticSearchTutorialDismissedCookie = async (dismissed: boolean) => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(AGENTIC_SEARCH_TUTORIAL_DISMISSED_COOKIE_NAME, dismissed ? "true" : "false", {
        httpOnly: false, // Allow client-side access
        maxAge: 365 * 24 * 60 * 60, // 1 year in seconds
    });
    return true;
});

// eslint-disable-next-line authz/require-auth-wrapper -- UI-only preference cookie, no DB access
export const dismissMobileUnsupportedSplashScreen = async () => sew(async () => {
    const cookieStore = await cookies();
    cookieStore.set(MOBILE_UNSUPPORTED_SPLASH_SCREEN_DISMISSED_COOKIE_NAME, 'true');
    return true;
});
