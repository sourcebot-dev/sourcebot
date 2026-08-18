import * as Sentry from "@sentry/node";
import { PermissionSyncSource, PrismaClient } from "@sourcebot/db";
import {
    createLogger,
    REPO_PERMISSION_SYNC_QUEUE,
    repoMetadataSchema,
} from "@sourcebot/shared";
import { hasEntitlement } from "../entitlements.js";
import {
    createOctokitFromToken,
    getRepoCollaborators,
    GITHUB_CLOUD_HOSTNAME,
} from "../github.js";
import {
    createGitLabFromPersonalAccessToken,
    getProjectMembers,
} from "../gitlab.js";
import {
    createBitbucketCloudClient,
    createBitbucketServerClient,
    getExplicitUserPermissionsForCloudRepo,
    getUserPermissionsForServerRepo,
} from "../bitbucket.js";
import {
    RepoAuthCredentials,
    RepoWithConnections,
    Settings,
    Workload,
} from "../types.js";
import { getAuthCredentialsForRepo } from "../utils.js";
import { BitbucketConnectionConfig } from "@sourcebot/schemas/v3/index.type";

interface RepoPermissionSyncWorkloadDependencies {
    db: PrismaClient;
    settings: Settings;
}

interface RepoPermissionSyncResult {
    repoName: string;
}

const REPO_PERMISSION_SYNC_LOCK_DURATION_MS = 60_000;
const logger = createLogger("repo-permission-sync-workload");

export const createRepoPermissionSyncWorkload = ({
    db,
    settings,
}: RepoPermissionSyncWorkloadDependencies): Workload<
    "repo-permission-sync",
    RepoPermissionSyncResult
> => ({
    queueSpec: REPO_PERMISSION_SYNC_QUEUE,
    concurrency: settings.maxRepoPermissionSyncJobConcurrency,
    executionLock: {
        resource: ({ repoId }) =>
            `sourcebot:lock:repo-permission-sync:${repoId}`,
        durationMs: REPO_PERMISSION_SYNC_LOCK_DURATION_MS,
    },
    process: async ({ data: { repoId }, signal }) => {
        signal.throwIfAborted();
        if (!(await hasEntitlement("permission-syncing"))) {
            throw new Error(
                "Permission syncing entitlement is not currently available.",
            );
        }

        signal.throwIfAborted();
        const repo = await db.repo.findUniqueOrThrow({
            where: {
                id: repoId,
            },
            include: {
                connections: {
                    include: {
                        connection: true,
                    },
                },
            },
        });
        signal.throwIfAborted();

        const id = repo.id;
        logger.debug(`Syncing permissions for repo ${repo.displayName}...`);

        const credentials = await getAuthCredentialsForRepo(repo, logger);
        signal.throwIfAborted();
        if (!credentials) {
            throw new Error(`No credentials found for repo ${id}`);
        }

        const { accountIds, isPartialSync = false } =
            await getPermissionSyncResult({
                db,
                repo,
                credentials,
            });

        signal.throwIfAborted();
        await db.$transaction([
            db.repo.update({
                where: {
                    id: repo.id,
                },
                data: {
                    permittedAccounts: {
                        // @note: if this is a partial sync, we only want to delete the repo-driven permissions
                        // since we don't want to overwrite the account-driven permissions.
                        deleteMany: isPartialSync
                            ? {
                                  source: PermissionSyncSource.REPO_DRIVEN,
                              }
                            : {},
                    },
                },
            }),
            db.accountToRepoPermission.createMany({
                data: accountIds.map((accountId) => ({
                    accountId,
                    repoId: repo.id,
                    source: PermissionSyncSource.REPO_DRIVEN,
                })),
                skipDuplicates: true,
            }),
        ]);
        signal.throwIfAborted();

        return {
            repoName: repo.displayName ?? repo.name,
        };
    },
    onStarted: async ({ data: { repoId }, jobId }) => {
        await db.repo.update({
            where: {
                id: repoId,
            },
            data: {
                latestPermissionSyncJobId: jobId,
            },
        });
    },
    onCompleted: async (
        { data: { repoId }, jobId },
        { repoName },
    ) => {
        await db.repo.updateMany({
            where: {
                id: repoId,
                latestPermissionSyncJobId: jobId,
            },
            data: {
                permissionSyncedAt: new Date(),
            },
        });

        logger.debug(`Permissions synced for repo ${repoName}`);
    },
    onTerminalFailure: async ({ data: { repoId }, jobId }, error) => {
        Sentry.captureException(error, {
            tags: {
                jobId,
                queue: REPO_PERMISSION_SYNC_QUEUE.name,
            },
        });

        logger.error(
            `Repo permission sync job failed for repo ${repoId}: ${error.message}`,
        );
    },
});

interface ProviderPermissionSyncProps {
    db: PrismaClient;
    repo: RepoWithConnections;
    credentials: RepoAuthCredentials;
}

interface PermissionSyncResult {
    accountIds: string[];
    isPartialSync?: boolean;
}

const getPermissionSyncResult = async (
    props: ProviderPermissionSyncProps,
): Promise<PermissionSyncResult> => {
    switch (props.repo.external_codeHostType) {
        case "github":
            return getGitHubPermissionSyncResult(props);
        case "gitlab":
            return getGitLabPermissionSyncResult(props);
        case "bitbucketCloud":
            return getBitbucketCloudPermissionSyncResult(props);
        case "bitbucketServer":
            return getBitbucketServerPermissionSyncResult(props);
        default:
            throw new Error(
                `Unsupported code host type: ${props.repo.external_codeHostType}`,
            );
    }
};

const getGitHubPermissionSyncResult = async ({
    db,
    repo,
    credentials,
}: ProviderPermissionSyncProps): Promise<PermissionSyncResult> => {
    const isGitHubCloud = credentials.hostUrl
        ? new URL(credentials.hostUrl).hostname === GITHUB_CLOUD_HOSTNAME
        : true;
    const { octokit } = await createOctokitFromToken({
        token: credentials.token,
        url: isGitHubCloud ? undefined : credentials.hostUrl,
    });

    // @note: this is a bit of a hack since the displayName _might_ not be set..
    // however, this property was introduced many versions ago and _should_ be set
    // on each connection sync. Let's throw an error just in case.
    if (!repo.displayName) {
        throw new Error(`Repo ${repo.id} does not have a displayName`);
    }

    const [owner, repoName] = repo.displayName.split("/");
    const collaborators = await getRepoCollaborators(owner, repoName, octokit);
    const githubUserIds = collaborators.map((collaborator) =>
        collaborator.id.toString(),
    );

    logger.debug(`Found ${collaborators.length} collaborator(s)`, {
        collaborators: collaborators.flatMap(({ email, login }) => ({email, login})),
    });

    const accounts = await db.account.findMany({
        where: {
            providerType: "github",
            providerAccountId: {
                in: githubUserIds,
            },
            issuerUrl: repo.external_codeHostUrl,
        },
    });

    return {
        accountIds: accounts.map((account) => account.id),
    };
};

const getGitLabPermissionSyncResult = async ({
    db,
    repo,
    credentials,
}: ProviderPermissionSyncProps): Promise<PermissionSyncResult> => {
    const api = await createGitLabFromPersonalAccessToken({
        token: credentials.token,
        url: credentials.hostUrl,
    });

    const projectId = repo.external_id;
    if (!projectId) {
        throw new Error(`Repo ${repo.id} does not have an external_id`);
    }

    const members = await getProjectMembers(projectId, api);
    const gitlabUserIds = members.map((member) => member.id.toString());

    const accounts = await db.account.findMany({
        where: {
            providerType: "gitlab",
            providerAccountId: {
                in: gitlabUserIds,
            },
            issuerUrl: repo.external_codeHostUrl,
        },
    });

    return {
        accountIds: accounts.map((account) => account.id),
    };
};

const getBitbucketCloudPermissionSyncResult = async ({
    db,
    repo,
    credentials,
}: ProviderPermissionSyncProps): Promise<PermissionSyncResult> => {
    const config = credentials.connectionConfig as
        | BitbucketConnectionConfig
        | undefined;
    if (!config) {
        throw new Error(`No connection config found for repo ${repo.id}`);
    }

    const client = createBitbucketCloudClient(config.user, credentials.token);

    const parsedMetadata = repoMetadataSchema.safeParse(repo.metadata);
    if (!parsedMetadata.success) {
        throw new Error(
            `Repo ${repo.id} has invalid metadata: ${JSON.stringify(parsedMetadata.error.errors)}`,
        );
    }
    const bitbucketCloudMetadata =
        parsedMetadata.data.codeHostMetadata?.bitbucketCloud;
    if (!bitbucketCloudMetadata) {
        throw new Error(
            `Repo ${repo.id} is missing required Bitbucket Cloud metadata (workspace/repoSlug)`,
        );
    }

    const { workspace, repoSlug } = bitbucketCloudMetadata;

    // @note: The Bitbucket Cloud permissions API only returns users who have been *directly*
    // granted access to this repository. Users who have access via a group added to the repo,
    // via project-level membership, or via a group in a project are NOT captured here.
    // These users will still gain access through account-driven permission syncing,
    // but there may be a delay of up to `userDrivenPermissionSyncIntervalMs` before
    // they see the repository in Sourcebot.
    // @see: https://developer.atlassian.com/cloud/bitbucket/rest/api-group-repositories/#api-repositories-workspace-repo-slug-permissions-config-users-get
    const users = await getExplicitUserPermissionsForCloudRepo(
        client,
        workspace,
        repoSlug,
    );
    const userAccountIds = users.map((user) => user.accountId);

    const accounts = await db.account.findMany({
        where: {
            providerType: "bitbucket-cloud",
            providerAccountId: {
                in: userAccountIds,
            },
            issuerUrl: repo.external_codeHostUrl,
        },
    });

    return {
        accountIds: accounts.map((account) => account.id),
        // Since we only fetch users who have been explicitly granted access to the repo,
        // this is a partial sync.
        isPartialSync: true,
    };
};

const getBitbucketServerPermissionSyncResult = async ({
    db,
    repo,
    credentials,
}: ProviderPermissionSyncProps): Promise<PermissionSyncResult> => {
    const parsedMetadata = repoMetadataSchema.safeParse(repo.metadata);
    if (!parsedMetadata.success) {
        throw new Error(
            `Repo ${repo.id} has invalid metadata: ${JSON.stringify(parsedMetadata.error.errors)}`,
        );
    }
    const bitbucketServerMetadata =
        parsedMetadata.data.codeHostMetadata?.bitbucketServer;
    if (!bitbucketServerMetadata) {
        throw new Error(
            `Repo ${repo.id} is missing required Bitbucket Server metadata (projectKey/repoSlug)`,
        );
    }

    const { projectKey, repoSlug } = bitbucketServerMetadata;
    const hostUrl = credentials.hostUrl;

    if (!hostUrl) {
        throw new Error(
            `No host URL found for Bitbucket Server repo ${repo.id}`,
        );
    }

    // @note: This covers users with direct repo-level and project-level permissions.
    // Users with access only via groups are NOT captured here. Those users will
    // still gain access through account-driven permission syncing.
    const client = createBitbucketServerClient(
        hostUrl,
        /* user = */ undefined,
        credentials.token,
    );
    const users = await getUserPermissionsForServerRepo(
        client,
        projectKey,
        repoSlug,
    );
    const userIds = users.map((user) => user.userId);

    const accounts = await db.account.findMany({
        where: {
            providerType: "bitbucket-server",
            providerAccountId: { in: userIds },
            issuerUrl: repo.external_codeHostUrl,
        },
    });

    return {
        accountIds: accounts.map((account) => account.id),
        isPartialSync: true,
    };
};
