import * as Sentry from "@sentry/node";
import {
    PrismaClient,
    AccountPermissionSyncIssue,
    AccountPermissionSyncJobStatus,
    Account,
    PermissionSyncSource,
} from "@sourcebot/db";
import { env, createLogger, getIdentityProviderConfig, PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS } from "@sourcebot/shared";
import { hasEntitlement } from "../entitlements.js";
import { ensureFreshAccountToken, TokenRefreshError } from "./tokenRefresh.js";
import { DelayedError, Job, Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
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
import { createBitbucketCloudClient, createBitbucketServerClient, getReposForAuthenticatedBitbucketCloudUser, getReposForAuthenticatedBitbucketServerUser } from "../bitbucket.js";
import { Settings } from "../types.js";
import { setIntervalAsync } from "../utils.js";
import { PermissionSyncUpstreamError, withPermissionSyncUpstreamError } from "./permissionSyncError.js";

const LOG_TAG = 'user-permission-syncer';
const logger = createLogger(LOG_TAG);
const createJobLogger = (jobId: string) => createLogger(`${LOG_TAG}:job:${jobId}`);

const QUEUE_NAME = 'accountPermissionSyncQueue';
const POLLING_INTERVAL_MS = 1000;
const ENTITLEMENT_RETRY_DELAY_MS = 30 * 1000;

type AccountPermissionSyncJob = {
    jobId: string;
}

export type PermissionCleanupReason =
    | 'oauth_refresh_token_rejected'
    | 'upstream_credential_rejected'
    | 'upstream_insufficient_scope';

export type PermissionCleanupDecision =
    | {
        action: 'clear_permissions';
        reason: PermissionCleanupReason;
    }
    | {
        action: 'preserve_permissions';
    };

const PERMISSION_CLEANUP_DETAILS: Record<PermissionCleanupReason, {
    message: string;
    issue: AccountPermissionSyncIssue;
}> = {
    oauth_refresh_token_rejected: {
        message: 'OAuth refresh token rejection',
        issue: AccountPermissionSyncIssue.REAUTHENTICATION_REQUIRED,
    },
    upstream_credential_rejected: {
        message: 'upstream credential rejection',
        issue: AccountPermissionSyncIssue.REAUTHENTICATION_REQUIRED,
    },
    upstream_insufficient_scope: {
        message: 'insufficient OAuth scope',
        issue: AccountPermissionSyncIssue.INSUFFICIENT_SCOPE,
    },
};

export const classifyPermissionSyncFailure = (error: unknown): PermissionCleanupDecision => {
    // Token refresh failures have their own classification. Do not fall through
    // to the generic HTTP checks because another token endpoint failure may
    // also carry a 401 or 403 status.
    if (error instanceof TokenRefreshError) {
        return error.kind === 'refresh_token_rejected'
            ? { action: 'clear_permissions', reason: 'oauth_refresh_token_rejected' }
            : { action: 'preserve_permissions' };
    }

    if (error instanceof PermissionSyncUpstreamError) {
        if (error.kind === 'credential_rejected') {
            return { action: 'clear_permissions', reason: 'upstream_credential_rejected' };
        }
        if (error.kind === 'insufficient_scope') {
            return { action: 'clear_permissions', reason: 'upstream_insufficient_scope' };
        }
    }

    return { action: 'preserve_permissions' };
};

export class AccountPermissionSyncer {
    private queue: Queue<AccountPermissionSyncJob>;
    private worker: Worker<AccountPermissionSyncJob>;
    private interval?: NodeJS.Timeout;

    constructor(
        private db: PrismaClient,
        private settings: Settings,
        redis: Redis,
    ) {
        this.queue = new Queue<AccountPermissionSyncJob>(QUEUE_NAME, {
            connection: redis,
        });
        this.worker = new Worker<AccountPermissionSyncJob>(QUEUE_NAME, this.runJob.bind(this), {
            connection: redis,
            concurrency: this.settings.maxAccountPermissionSyncJobConcurrency,
        });
        this.worker.on('completed', this.onJobCompleted.bind(this));
        this.worker.on('failed', this.onJobFailed.bind(this));
    }

    public async startScheduler() {
        logger.debug('Starting scheduler');

        this.interval = setIntervalAsync(async () => {
            if (!await hasEntitlement('permission-syncing')) {
                return;
            }

            const thresholdDate = new Date(Date.now() - this.settings.userDrivenPermissionSyncIntervalMs);

            const accounts = await this.db.account.findMany({
                where: {
                    AND: [
                        {
                            providerType: {
                                in: PERMISSION_SYNC_SUPPORTED_IDENTITY_PROVIDERS
                            }
                        },
                        {
                            OR: [
                                { permissionSyncedAt: null },
                                { permissionSyncedAt: { lt: thresholdDate } },
                            ]
                        },
                        {
                            NOT: {
                                permissionSyncJobs: {
                                    some: {
                                        OR: [
                                            // Don't schedule if there are active jobs
                                            {
                                                status: {
                                                    in: [
                                                        AccountPermissionSyncJobStatus.PENDING,
                                                        AccountPermissionSyncJobStatus.IN_PROGRESS,
                                                    ],
                                                }
                                            },
                                            // Don't schedule if there are recent failed jobs (within the threshold date). Note `gt` is used here since this is a inverse condition.
                                            {
                                                AND: [
                                                    { status: AccountPermissionSyncJobStatus.FAILED },
                                                    { completedAt: { gt: thresholdDate } },
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        },
                    ]
                }
            });

            await this.schedulePermissionSync(accounts);
        }, POLLING_INTERVAL_MS);
    }

    public async dispose() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        await this.worker.close(/* force = */ true);
        await this.queue.close();
    }

    public async schedulePermissionSyncForAccount(account: Account) {
        const [job] = await this.db.accountPermissionSyncJob.createManyAndReturn({
            data: [{ accountId: account.id }],
        });

        await this.queue.add('accountPermissionSyncJob', {
            jobId: job.id,
        }, {
            removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
            removeOnFail: env.REDIS_REMOVE_ON_FAIL,
            priority: 1,
        });

        return job.id;
    }

    private async schedulePermissionSync(accounts: Account[]) {
        // @note: we don't perform this in a transaction because
        // we want to avoid the situation where a job is created and run
        // prior to the transaction being committed.
        const jobs = await this.db.accountPermissionSyncJob.createManyAndReturn({
            data: accounts.map(account => ({
                accountId: account.id,
            })),
            include: {
                account: true,
            }
        });

        await this.queue.addBulk(jobs.map((job) => ({
            name: 'accountPermissionSyncJob',
            data: {
                jobId: job.id,
            },
            opts: {
                removeOnComplete: env.REDIS_REMOVE_ON_COMPLETE,
                removeOnFail: env.REDIS_REMOVE_ON_FAIL,
                // Priority 1 (high) for never-synced, Priority 2 (normal) for re-sync
                priority: job.account.permissionSyncedAt === null ? 1 : 2,
            }
        })))
    }

    private async runJob(job: Job<AccountPermissionSyncJob>) {
        if (!await hasEntitlement('permission-syncing')) {
            await job.moveToDelayed(Date.now() + ENTITLEMENT_RETRY_DELAY_MS, job.token);
            throw new DelayedError('Permission syncing entitlement is not currently available.');
        }

        const id = job.data.jobId;
        const logger = createJobLogger(id);

        const { account } = await this.db.accountPermissionSyncJob.update({
            where: {
                id,
            },
            data: {
                status: AccountPermissionSyncJobStatus.IN_PROGRESS,
            },
            select: {
                account: {
                    include: {
                        user: true,
                    }
                }
            }
        });

        try {
            await this.syncAccountPermissions(account, logger);
        } catch (error) {
            // Clear cached permissions only for classified permanent failures.
            // Ambiguous HTTP errors and transient upstream failures preserve the
            // last successful permission state.
            const cleanupDecision = classifyPermissionSyncFailure(error);

            if (cleanupDecision.action === 'clear_permissions') {
                const details = PERMISSION_CLEANUP_DETAILS[cleanupDecision.reason];
                const [{ count }] = await this.db.$transaction([
                    this.db.accountToRepoPermission.deleteMany({
                        where: { accountId: account.id },
                    }),
                    this.db.account.update({
                        where: { id: account.id },
                        data: {
                            permissionSyncIssue: details.issue,
                            permissionSyncIssueAt: new Date(),
                        },
                    }),
                ]);
                const message = error instanceof Error ? error.message : String(error);
                logger.warn(`Cleared ${count} permission row(s) for account ${account.id} (user ${account.user.email ?? 'unknown'}) — fail-closed cleanup triggered by ${details.message}: ${message}`);
            }
            throw error;
        }
    }

    private async syncAccountPermissions(
        account: Account & { user: { email: string | null } },
        logger: ReturnType<typeof createJobLogger>,
    ) {
        logger.debug(`Syncing permissions for ${account.providerId} account (id: ${account.id}) for user ${account.user.email}...`);

        // Ensure the OAuth token is fresh, refreshing it if it is expired or near expiry.
        const accessToken = await ensureFreshAccountToken(account, this.db);

        // Get a list of all repos that the user has access to from all connected accounts.
        const repoIds = await (async () => {
            const aggregatedRepoIds: Set<number> = new Set();

            const idpConfig = await getIdentityProviderConfig(account.providerId);

            if (!idpConfig) {
                throw new Error(`Unable to find IDP config in config.json.`);
            }

            if (idpConfig.provider === 'github') {
                const { octokit } = await createOctokitFromToken({
                    token: accessToken,
                    url: idpConfig.baseUrl,
                });

                const scopes = await withPermissionSyncUpstreamError(
                    'github',
                    'inspect_token_scopes',
                    () => getGitHubOAuthScopesForAuthenticatedUser(octokit, accessToken),
                );

                // Token supports scope introspection (classic PAT or OAuth app token)
                if (scopes !== null) {
                    if (!scopes.includes('repo')) {
                        throw new PermissionSyncUpstreamError(
                            `OAuth token with scopes [${scopes.join(', ')}] is missing the 'repo' scope required for permission syncing. Please re-authorize with GitHub to grant the required scope.`,
                            {
                                kind: 'insufficient_scope',
                                provider: 'github',
                                operation: 'inspect_token_scopes',
                            },
                        );
                    }
                }

                // @note: we only care about the private repos since we don't need to build a mapping
                // for public repos.
                // @see: packages/web/src/prisma.ts
                const githubRepos = await withPermissionSyncUpstreamError(
                    'github',
                    'list_accessible_repositories',
                    () => getReposForAuthenticatedUser(/* visibility = */ 'private', octokit),
                );
                const gitHubRepoIds = githubRepos.map(repo => repo.id.toString());

                const repos = await this.db.repo.findMany({
                    where: {
                        external_codeHostType: 'github',
                        external_id: {
                            in: gitHubRepoIds,
                        },
                        ...(account.issuerUrl ? {
                            external_codeHostUrl: account.issuerUrl,
                        } : {}),
                    }
                });

                repos.forEach(repo => aggregatedRepoIds.add(repo.id));
            } else if (idpConfig.provider === 'gitlab') {
                const api = await createGitLabFromOAuthToken({
                    oauthToken: accessToken,
                    url: idpConfig.baseUrl,
                });

                const scopes = await withPermissionSyncUpstreamError(
                    'gitlab',
                    'inspect_token_scopes',
                    () => getGitLabOAuthScopesForAuthenticatedUser(api),
                );
                if (!scopes.includes('read_api')) {
                    throw new PermissionSyncUpstreamError(
                        `OAuth token with scopes [${scopes.join(', ')}] is missing the 'read_api' scope required for permission syncing.`,
                        {
                            kind: 'insufficient_scope',
                            provider: 'gitlab',
                            operation: 'inspect_token_scopes',
                        },
                    );
                }

                // @note: we only care about the private repos since we don't need to build a
                // mapping for public or internal repos. Note that internal repos are _not_
                // enforced by permission syncing and therefore we don't need to fetch them
                // here.
                // 
                // @see: packages/web/src/prisma.ts
                const gitLabProjectIds = (
                    await withPermissionSyncUpstreamError(
                        'gitlab',
                        'list_accessible_repositories',
                        () => getProjectsForAuthenticatedUser('private', api),
                    )
                ).map(project => project.id.toString());

                const repos = await this.db.repo.findMany({
                    where: {
                        external_codeHostType: 'gitlab',
                        external_id: {
                            in: gitLabProjectIds,
                        },
                        ...(account.issuerUrl ? {
                            external_codeHostUrl: account.issuerUrl,
                        } : {}),
                    }
                });

                repos.forEach(repo => aggregatedRepoIds.add(repo.id));
            } else if (idpConfig.provider === 'bitbucket-cloud') {
                // @note: we don't pass a user here since we want to use a bearer token
                // for authentication.
                const client = createBitbucketCloudClient(/* user = */ undefined, accessToken)
                const bitbucketRepos = await withPermissionSyncUpstreamError(
                    'bitbucket-cloud',
                    'list_accessible_repositories',
                    () => getReposForAuthenticatedBitbucketCloudUser(client),
                );
                const bitbucketRepoUuids = bitbucketRepos.map(repo => repo.uuid);

                const repos = await this.db.repo.findMany({
                    where: {
                        external_codeHostType: 'bitbucketCloud',
                        external_id: {
                            in: bitbucketRepoUuids,
                        },
                        ...(account.issuerUrl ? {
                            external_codeHostUrl: account.issuerUrl,
                        } : {}),
                    }
                });

                repos.forEach(repo => aggregatedRepoIds.add(repo.id));
            } else if (idpConfig.provider === 'bitbucket-server') {
                const client = createBitbucketServerClient(idpConfig.baseUrl, /* user = */ undefined, accessToken);
                const serverRepos = await withPermissionSyncUpstreamError(
                    'bitbucket-server',
                    'list_accessible_repositories',
                    () => getReposForAuthenticatedBitbucketServerUser(client),
                );
                const serverRepoIds = serverRepos.map(r => r.id);

                const repos = await this.db.repo.findMany({
                    where: {
                        external_codeHostType: 'bitbucketServer',
                        external_id: { in: serverRepoIds },
                        ...(account.issuerUrl ? {
                            external_codeHostUrl: account.issuerUrl,
                        } : {}),
                    }
                });

                repos.forEach(repo => aggregatedRepoIds.add(repo.id));
            } else {
                throw new Error(`Unsupported provider type: ${idpConfig.provider}`);
            }

            return Array.from(aggregatedRepoIds);
        })();

        await this.db.$transaction([
            this.db.account.update({
                where: {
                    id: account.id,
                },
                data: {
                    accessibleRepos: {
                        deleteMany: {},
                    }
                }
            }),
            this.db.accountToRepoPermission.createMany({
                data: repoIds.map(repoId => ({
                    accountId: account.id,
                    repoId,
                    source: PermissionSyncSource.ACCOUNT_DRIVEN,
                })),
                skipDuplicates: true,
            })
        ]);
    }

    private async onJobCompleted(job: Job<AccountPermissionSyncJob>) {
        const logger = createJobLogger(job.data.jobId);

        const { account } = await this.db.accountPermissionSyncJob.update({
            where: {
                id: job.data.jobId,
            },
            data: {
                status: AccountPermissionSyncJobStatus.COMPLETED,
                account: {
                    update: {
                        permissionSyncedAt: new Date(),
                        permissionSyncIssue: null,
                        permissionSyncIssueAt: null,
                    },
                },
                completedAt: new Date(),
            },
            select: {
                account: {
                    include: {
                        user: true,
                    }
                }
            }
        });

        logger.debug(`Permissions synced for ${account.providerId} account (id: ${account.id}) for user ${account.user.email}`);
    }

    private async onJobFailed(job: Job<AccountPermissionSyncJob> | undefined, err: Error) {
        const logger = createJobLogger(job?.data.jobId ?? 'unknown');

        Sentry.captureException(err, {
            tags: {
                jobId: job?.data.jobId,
                queue: QUEUE_NAME,
            }
        });

        const errorMessage = (accountId: string, email: string) => `Account permission sync job failed for account (id: ${accountId}) for user ${email}: ${err.message}`;

        if (job) {
            const { account } = await this.db.accountPermissionSyncJob.update({
                where: {
                    id: job.data.jobId,
                },
                data: {
                    status: AccountPermissionSyncJobStatus.FAILED,
                    completedAt: new Date(),
                    errorMessage: err.message,
                },
                select: {
                    account: {
                        include: {
                            user: true,
                        }
                    }
                }
            });

            logger.error(errorMessage(account.id, account.user.email ?? 'unknown user (email not found)'));
        } else {
            logger.error(errorMessage('unknown account (id not found)', 'unknown user (id not found)'));
        }
    }
}
