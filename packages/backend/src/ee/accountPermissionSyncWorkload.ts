import * as Sentry from "@sentry/node";
import {
    Account,
    AccountPermissionSyncIssue,
    AccountPermissionSyncJobStatus,
    PermissionSyncSource,
    PrismaClient,
} from "@sourcebot/db";
import {
    ACCOUNT_PERMISSION_SYNC_QUEUE,
    createLogger,
    getIdentityProviderConfig,
} from "@sourcebot/shared";
import {
    createBitbucketCloudClient,
    createBitbucketServerClient,
    getReposForAuthenticatedBitbucketCloudUser,
    getReposForAuthenticatedBitbucketServerUser,
} from "../bitbucket.js";
import { hasEntitlement } from "../entitlements.js";
import {
    createOctokitFromToken,
    getOAuthScopesForAuthenticatedUser as getGitHubOAuthScopesForAuthenticatedUser,
    getReposForAuthenticatedUser,
} from "../github.js";
import {
    createGitLabFromOAuthToken,
    getOAuthScopesForAuthenticatedUser as getGitLabOAuthScopesForAuthenticatedUser,
    getProjectsForAuthenticatedUser,
} from "../gitlab.js";
import {
    PermissionSyncUpstreamError,
    withPermissionSyncUpstreamError,
} from "./permissionSyncError.js";
import { ensureFreshAccountToken, TokenRefreshError } from "./tokenRefresh.js";
import { Settings, Workload } from "../types.js";
import { IdentityProviderConfig } from "@sourcebot/schemas/v3/index.type";

type AccountWithUser = Account & { user: { email: string | null } };

type SupportedProvider =
    | "github"
    | "gitlab"
    | "bitbucket-cloud"
    | "bitbucket-server";
type ProviderConfig<TProvider extends SupportedProvider> = Extract<
    IdentityProviderConfig,
    { provider: TProvider }
>;

const ACCOUNT_PERMISSION_SYNC_LOCK_DURATION_MS = 60_000;
const logger = createLogger("account-permission-sync-workload");

interface ProviderPermissionSyncProps<TProvider extends SupportedProvider> {
    db: PrismaClient;
    account: AccountWithUser;
    accessToken: string;
    config: ProviderConfig<TProvider>;
}

export type PermissionCleanupReason =
    | "oauth_refresh_token_rejected"
    | "upstream_credential_rejected"
    | "upstream_insufficient_scope";

export type PermissionCleanupDecision =
    | {
          action: "clear_permissions";
          reason: PermissionCleanupReason;
      }
    | {
          action: "preserve_permissions";
      };

export const classifyPermissionSyncFailure = (
    error: unknown,
): PermissionCleanupDecision => {
    // Token refresh failures have their own classification. Do not fall through
    // to the generic HTTP checks because another token endpoint failure may
    // also carry a 401 or 403 status.
    if (error instanceof TokenRefreshError) {
        return error.kind === "refresh_token_rejected"
            ? {
                  action: "clear_permissions",
                  reason: "oauth_refresh_token_rejected",
              }
            : { action: "preserve_permissions" };
    }

    if (error instanceof PermissionSyncUpstreamError) {
        if (error.kind === "credential_rejected") {
            return {
                action: "clear_permissions",
                reason: "upstream_credential_rejected",
            };
        }
        if (error.kind === "insufficient_scope") {
            return {
                action: "clear_permissions",
                reason: "upstream_insufficient_scope",
            };
        }
    }

    return { action: "preserve_permissions" };
};

const PERMISSION_CLEANUP_DETAILS: Record<
    PermissionCleanupReason,
    {
        message: string;
        issue: AccountPermissionSyncIssue;
    }
> = {
    oauth_refresh_token_rejected: {
        message: "OAuth refresh token rejection",
        issue: AccountPermissionSyncIssue.REAUTHENTICATION_REQUIRED,
    },
    upstream_credential_rejected: {
        message: "upstream credential rejection",
        issue: AccountPermissionSyncIssue.REAUTHENTICATION_REQUIRED,
    },
    upstream_insufficient_scope: {
        message: "insufficient OAuth scope",
        issue: AccountPermissionSyncIssue.INSUFFICIENT_SCOPE,
    },
};

interface AccountPermissionSyncWorkloadDependencies {
    db: PrismaClient;
    settings: Settings;
}

export const createAccountPermissionSyncWorkload = ({
    db,
    settings,
}: AccountPermissionSyncWorkloadDependencies): Workload<"account-permission-sync"> => {
    return {
        queueSpec: ACCOUNT_PERMISSION_SYNC_QUEUE,
        concurrency: settings.maxAccountPermissionSyncJobConcurrency,
        executionLock: {
            resource: ({ accountId }) =>
                `sourcebot:lock:account:${accountId}`,
            durationMs: ACCOUNT_PERMISSION_SYNC_LOCK_DURATION_MS,
        },
        process: async ({
            data: { accountId },
            signal,
        }) => {
            signal.throwIfAborted();
            if (!(await hasEntitlement("permission-syncing"))) {
                throw new Error(
                    "Permission syncing entitlement is not currently available.",
                );
            }

            signal.throwIfAborted();
            const account = await db.account.findUniqueOrThrow({
                where: {
                    id: accountId,
                },
                include: {
                    user: true,
                },
            });
            signal.throwIfAborted();

            logger.debug(
                `Syncing permissions for ${account.providerId} account (id: ${account.id}) for user ${account.user.email}...`,
            );

            try {
                // Ensure the OAuth token is fresh, refreshing it if it is expired or near expiry.
                const accessToken = await ensureFreshAccountToken(account, db);
                signal.throwIfAborted();

                const idpConfig = await getIdentityProviderConfig(
                    account.providerId,
                );
                signal.throwIfAborted();
                if (!idpConfig) {
                    throw new Error(
                        "Unable to find IDP config in config.json.",
                    );
                }

                const repoIds = await getAccessibleRepoIds({
                    db,
                    account,
                    accessToken,
                    config: idpConfig,
                });

                signal.throwIfAborted();
                await db.$transaction([
                    db.account.update({
                        where: {
                            id: account.id,
                        },
                        data: {
                            accessibleRepos: {
                                deleteMany: {},
                            },
                        },
                    }),
                    db.accountToRepoPermission.createMany({
                        data: repoIds.map((repoId) => ({
                            accountId: account.id,
                            repoId,
                            source: PermissionSyncSource.ACCOUNT_DRIVEN,
                        })),
                        skipDuplicates: true,
                    }),
                ]);
                signal.throwIfAborted();
            } catch (error) {
                signal.throwIfAborted();
                // Clear cached permissions only for classified permanent failures.
                // Ambiguous HTTP errors and transient upstream failures preserve the
                // last successful permission state.
                const cleanupDecision = classifyPermissionSyncFailure(error);

                if (cleanupDecision.action === "clear_permissions") {
                    const details =
                        PERMISSION_CLEANUP_DETAILS[cleanupDecision.reason];
                    signal.throwIfAborted();
                    const [{ count }] = await db.$transaction([
                        db.accountToRepoPermission.deleteMany({
                            where: { accountId: account.id },
                        }),
                        db.account.update({
                            where: { id: account.id },
                            data: {
                                permissionSyncIssue: details.issue,
                                permissionSyncIssueAt: new Date(),
                            },
                        }),
                    ]);
                    signal.throwIfAborted();
                    const message =
                        error instanceof Error ? error.message : String(error);
                    logger.warn(
                        `Cleared ${count} permission row(s) for account ${account.id} (user ${account.user.email ?? "unknown"}) — fail-closed cleanup triggered by ${details.message}: ${message}`,
                    );
                }
                throw error;
            }
        },
        onStarted: async ({ data: { accountId }, jobId }) => {
            await db.$transaction(async (tx) => {
                await tx.accountPermissionSyncJob.upsert({
                    where: {
                        id: jobId,
                    },
                    update: {
                        status: AccountPermissionSyncJobStatus.IN_PROGRESS,
                        completedAt: null,
                        errorMessage: null,
                    },
                    create: {
                        id: jobId,
                        accountId,
                        status: AccountPermissionSyncJobStatus.IN_PROGRESS,
                    },
                });
                await tx.account.update({
                    where: {
                        id: accountId,
                    },
                    data: {
                        latestPermissionSyncJobId: jobId,
                    },
                });
            });
        },
        onCompleted: async ({
            data: { accountId },
            jobId,
        }) => {
            const account = await db.$transaction(async (tx) => {
                await tx.accountPermissionSyncJob.updateMany({
                    where: {
                        id: jobId,
                    },
                    data: {
                        status: AccountPermissionSyncJobStatus.COMPLETED,
                        completedAt: new Date(),
                        errorMessage: null,
                    },
                });
                await tx.account.updateMany({
                    where: {
                        id: accountId,
                        latestPermissionSyncJobId: jobId,
                    },
                    data: {
                        permissionSyncedAt: new Date(),
                        permissionSyncIssue: null,
                        permissionSyncIssueAt: null,
                    },
                });
                return tx.account.findUnique({
                    where: {
                        id: accountId,
                    },
                    include: {
                        user: true,
                    },
                });
            });

            if (account) {
                logger.debug(
                    `Permissions synced for ${account.providerId} account (id: ${account.id}) for user ${account.user.email}`,
                );
            }
        },
        onTerminalFailure: async (
            { data: { accountId }, jobId },
            error,
        ) => {
            Sentry.captureException(error, {
                tags: {
                    jobId,
                    queue: ACCOUNT_PERMISSION_SYNC_QUEUE.name,
                },
            });

            await db.accountPermissionSyncJob.updateMany({
                where: {
                    id: jobId,
                },
                data: {
                    status: AccountPermissionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: error.message,
                },
            });
            const account = await db.account.findUnique({
                where: {
                    id: accountId,
                },
                include: {
                    user: true,
                },
            });

            logger.error(
                `Account permission sync job failed for account (id: ${accountId}) for user ${account?.user.email ?? "unknown user (email not found)"}: ${error.message}`,
            );
        },
    };
};

const getAccessibleRepoIds = async ({
    db,
    account,
    accessToken,
    config,
}: {
    db: PrismaClient;
    account: AccountWithUser;
    accessToken: string;
    config: IdentityProviderConfig;
}): Promise<number[]> => {
    switch (config.provider) {
        case "github":
            return getGitHubAccessibleRepoIds({
                db,
                account,
                accessToken,
                config,
            });
        case "gitlab":
            return getGitLabAccessibleRepoIds({
                db,
                account,
                accessToken,
                config,
            });
        case "bitbucket-cloud":
            return getBitbucketCloudAccessibleRepoIds({
                db,
                account,
                accessToken,
                config,
            });
        case "bitbucket-server":
            return getBitbucketServerAccessibleRepoIds({
                db,
                account,
                accessToken,
                config,
            });
        default:
            throw new Error(`Unsupported provider type: ${config.provider}`);
    }
};

const getGitHubAccessibleRepoIds = async ({
    db,
    account,
    accessToken,
    config,
}: ProviderPermissionSyncProps<"github">): Promise<number[]> => {
    const { octokit } = await createOctokitFromToken({
        token: accessToken,
        url: config.baseUrl,
    });

    const scopes = await withPermissionSyncUpstreamError(
        "github",
        "inspect_token_scopes",
        () => getGitHubOAuthScopesForAuthenticatedUser(octokit, accessToken),
    );

    // Token supports scope introspection (classic PAT or OAuth app token).
    if (scopes !== null && !scopes.includes("repo")) {
        throw new PermissionSyncUpstreamError(
            `OAuth token with scopes [${scopes.join(", ")}] is missing the 'repo' scope required for permission syncing. Please re-authorize with GitHub to grant the required scope.`,
            {
                kind: "insufficient_scope",
                provider: "github",
                operation: "inspect_token_scopes",
            },
        );
    }

    // Public repos do not need an explicit permission mapping.
    const githubRepos = await withPermissionSyncUpstreamError(
        "github",
        "list_accessible_repositories",
        () => getReposForAuthenticatedUser("private", octokit),
    );
    const gitHubRepoIds = githubRepos.map((repo) => repo.id.toString());

    const repos = await db.repo.findMany({
        where: {
            external_codeHostType: "github",
            external_id: {
                in: gitHubRepoIds,
            },
            ...(account.issuerUrl
                ? {
                      external_codeHostUrl: account.issuerUrl,
                  }
                : {}),
        },
    });

    return repos.map((repo) => repo.id);
};

const getGitLabAccessibleRepoIds = async ({
    db,
    account,
    accessToken,
    config,
}: ProviderPermissionSyncProps<"gitlab">): Promise<number[]> => {
    const api = await createGitLabFromOAuthToken({
        oauthToken: accessToken,
        url: config.baseUrl,
    });

    const scopes = await withPermissionSyncUpstreamError(
        "gitlab",
        "inspect_token_scopes",
        () => getGitLabOAuthScopesForAuthenticatedUser(api),
    );
    if (!scopes.includes("read_api")) {
        throw new PermissionSyncUpstreamError(
            `OAuth token with scopes [${scopes.join(", ")}] is missing the 'read_api' scope required for permission syncing.`,
            {
                kind: "insufficient_scope",
                provider: "gitlab",
                operation: "inspect_token_scopes",
            },
        );
    }

    // Public and internal repos do not need an explicit permission mapping.
    const gitLabProjectIds = (
        await withPermissionSyncUpstreamError(
            "gitlab",
            "list_accessible_repositories",
            () => getProjectsForAuthenticatedUser("private", api),
        )
    ).map((project) => project.id.toString());

    const repos = await db.repo.findMany({
        where: {
            external_codeHostType: "gitlab",
            external_id: {
                in: gitLabProjectIds,
            },
            ...(account.issuerUrl
                ? {
                      external_codeHostUrl: account.issuerUrl,
                  }
                : {}),
        },
    });

    return repos.map((repo) => repo.id);
};

const getBitbucketCloudAccessibleRepoIds = async ({
    db,
    account,
    accessToken,
}: ProviderPermissionSyncProps<"bitbucket-cloud">): Promise<number[]> => {
    // Use a bearer token by omitting the user.
    const client = createBitbucketCloudClient(undefined, accessToken);
    const bitbucketRepos = await withPermissionSyncUpstreamError(
        "bitbucket-cloud",
        "list_accessible_repositories",
        () => getReposForAuthenticatedBitbucketCloudUser(client),
    );
    const bitbucketRepoUuids = bitbucketRepos.map((repo) => repo.uuid);

    const repos = await db.repo.findMany({
        where: {
            external_codeHostType: "bitbucketCloud",
            external_id: {
                in: bitbucketRepoUuids,
            },
            ...(account.issuerUrl
                ? {
                      external_codeHostUrl: account.issuerUrl,
                  }
                : {}),
        },
    });

    return repos.map((repo) => repo.id);
};

const getBitbucketServerAccessibleRepoIds = async ({
    db,
    account,
    accessToken,
    config,
}: ProviderPermissionSyncProps<"bitbucket-server">): Promise<number[]> => {
    const client = createBitbucketServerClient(
        config.baseUrl,
        undefined,
        accessToken,
    );
    const serverRepos = await withPermissionSyncUpstreamError(
        "bitbucket-server",
        "list_accessible_repositories",
        () => getReposForAuthenticatedBitbucketServerUser(client),
    );
    const serverRepoIds = serverRepos.map((repo) => repo.id);

    const repos = await db.repo.findMany({
        where: {
            external_codeHostType: "bitbucketServer",
            external_id: { in: serverRepoIds },
            ...(account.issuerUrl
                ? {
                      external_codeHostUrl: account.issuerUrl,
                  }
                : {}),
        },
    });

    return repos.map((repo) => repo.id);
};
