import type { PrismaClient } from "@sourcebot/db";
import type { JobLogger } from "@sourcebot/shared";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    captureException: vi.fn(),
    createBitbucketCloudClient: vi.fn(),
    createBitbucketServerClient: vi.fn(),
    ensureFreshAccountToken: vi.fn(),
    getIdentityProviderConfig: vi.fn(),
    getReposForAuthenticatedBitbucketCloudUser: vi.fn(),
    getReposForAuthenticatedBitbucketServerUser: vi.fn(),
    hasEntitlement: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
    captureException: mocks.captureException,
}));

vi.mock("@sourcebot/shared", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@sourcebot/shared")>()),
    ACCOUNT_PERMISSION_SYNC_QUEUE: {
        name: "account-permission-sync",
        jobOptions: {
            attempts: 2,
            backoff: { type: "exponential", delayMs: 5000 },
            keepJobs: {
                completed: { count: 50 },
                failed: { count: 50 },
            },
            keepLogs: 500,
        },
    },
    getIdentityProviderConfig: mocks.getIdentityProviderConfig,
}));

vi.mock("../entitlements.js", () => ({
    hasEntitlement: mocks.hasEntitlement,
}));

vi.mock("../bitbucket.js", () => ({
    createBitbucketCloudClient: mocks.createBitbucketCloudClient,
    createBitbucketServerClient: mocks.createBitbucketServerClient,
    getReposForAuthenticatedBitbucketCloudUser:
        mocks.getReposForAuthenticatedBitbucketCloudUser,
    getReposForAuthenticatedBitbucketServerUser:
        mocks.getReposForAuthenticatedBitbucketServerUser,
}));

vi.mock("./tokenRefresh.js", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./tokenRefresh.js")>()),
    ensureFreshAccountToken: mocks.ensureFreshAccountToken,
}));

import {
    classifyPermissionSyncFailure,
    createAccountPermissionSyncWorkload,
} from "./accountPermissionSyncWorkload.js";
import {
    PermissionSyncUpstreamError,
    type PermissionSyncUpstreamErrorKind,
} from "./permissionSyncError.js";
import {
    TokenRefreshError,
    type TokenRefreshErrorKind,
} from "./tokenRefresh.js";

const tokenRefreshError = (
    kind: TokenRefreshErrorKind,
    status?: number,
): TokenRefreshError =>
    new TokenRefreshError(`Token refresh failed: ${kind}`, {
        kind,
        status,
    });

const upstreamError = (
    kind: PermissionSyncUpstreamErrorKind,
): PermissionSyncUpstreamError =>
    new PermissionSyncUpstreamError(`Permission sync failed: ${kind}`, {
        kind,
        provider: "github",
        operation: "list_accessible_repositories",
    });

const account = {
    id: "account_1",
    providerId: "bitbucket-server",
    issuerUrl: "https://bitbucket.example.com",
    user: { email: "user@example.com" },
};
const accountFindUniqueOrThrow = vi.fn().mockResolvedValue(account);
const accountUpdate = vi.fn().mockResolvedValue(account);
const repoFindMany = vi.fn().mockResolvedValue([]);
const permissionCreateMany = vi.fn().mockResolvedValue({ count: 0 });
const permissionDeleteMany = vi.fn().mockResolvedValue({ count: 95 });
const permissionSyncJobUpsert = vi.fn();
const permissionSyncJobUpdate = vi.fn().mockResolvedValue({ account });
const transaction = vi.fn((queries: Array<Promise<unknown>>) =>
    Promise.all(queries),
);

const db = {
    account: {
        findUniqueOrThrow: accountFindUniqueOrThrow,
        update: accountUpdate,
    },
    accountToRepoPermission: {
        createMany: permissionCreateMany,
        deleteMany: permissionDeleteMany,
    },
    repo: {
        findMany: repoFindMany,
    },
    accountPermissionSyncJob: {
        upsert: permissionSyncJobUpsert,
        update: permissionSyncJobUpdate,
    },
    $transaction: transaction,
} as unknown as PrismaClient;

const jobLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    flush: vi.fn(),
} satisfies JobLogger;

const createWorkload = () =>
    createAccountPermissionSyncWorkload({
        db,
        settings: {
            maxAccountPermissionSyncJobConcurrency: 2,
        } as never,
    });

const lifecycleContext = {
    data: {
        accountId: "account_1",
    },
    jobId: "job_1",
    attemptsMade: 0,
    maxAttempts: 2,
    prisma: db,
    logger: jobLogger,
};

const processContext = {
    ...lifecycleContext,
    signal: new AbortController().signal,
    updateProgress: vi.fn(),
    trigger: vi.fn(),
};

beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasEntitlement.mockResolvedValue(true);
    mocks.ensureFreshAccountToken.mockReset().mockResolvedValue("access-token");
    mocks.getIdentityProviderConfig.mockReset().mockResolvedValue({
        provider: "bitbucket-server",
        baseUrl: "https://bitbucket.example.com",
    });
    mocks.createBitbucketServerClient.mockReset().mockReturnValue({});
    mocks.getReposForAuthenticatedBitbucketServerUser
        .mockReset()
        .mockResolvedValue([]);
    accountFindUniqueOrThrow.mockResolvedValue(account);
    repoFindMany.mockResolvedValue([]);
    permissionCreateMany.mockResolvedValue({ count: 0 });
    permissionDeleteMany.mockResolvedValue({ count: 95 });
    permissionSyncJobUpdate.mockResolvedValue({ account });
});

describe("classifyPermissionSyncFailure", () => {
    test("fails closed when the refresh token is rejected", () => {
        expect(
            classifyPermissionSyncFailure(
                tokenRefreshError("refresh_token_rejected", 400),
            ),
        ).toEqual({
            action: "clear_permissions",
            reason: "oauth_refresh_token_rejected",
        });
    });

    test.each([
        ["transient", 500],
        ["configuration", 400],
        ["invalid_response", undefined],
        ["local_credential", undefined],
    ] satisfies Array<[TokenRefreshErrorKind, number | undefined]>)(
        "keeps permissions for a %s token refresh failure",
        (kind, status) => {
            expect(
                classifyPermissionSyncFailure(tokenRefreshError(kind, status)),
            ).toEqual({
                action: "preserve_permissions",
            });
        },
    );

    test("does not treat a token refresh configuration error with HTTP 401 as an API authorization failure", () => {
        expect(
            classifyPermissionSyncFailure(
                tokenRefreshError("configuration", 401),
            ),
        ).toEqual({
            action: "preserve_permissions",
        });
    });

    test.each([
        ["credential_rejected", "upstream_credential_rejected"],
        ["insufficient_scope", "upstream_insufficient_scope"],
    ] as const)(
        "fails closed for a classified %s upstream failure",
        (kind, reason) => {
            expect(classifyPermissionSyncFailure(upstreamError(kind))).toEqual({
                action: "clear_permissions",
                reason,
            });
        },
    );

    test.each([
        "rate_limited",
        "upstream_unavailable",
        "forbidden",
        "unknown",
    ] satisfies PermissionSyncUpstreamErrorKind[])(
        "keeps permissions for a classified %s upstream failure",
        (kind) => {
            expect(classifyPermissionSyncFailure(upstreamError(kind))).toEqual({
                action: "preserve_permissions",
            });
        },
    );

    test.each([401, 403, 410])(
        "does not fail closed on an unclassified HTTP %s error",
        (status) => {
            const error = Object.assign(new Error(`HTTP ${status}`), {
                status,
            });
            expect(classifyPermissionSyncFailure(error)).toEqual({
                action: "preserve_permissions",
            });
        },
    );
});

describe("accountPermissionSyncWorkload", () => {
    test("uses the configured concurrency and database-backed lifecycle hooks", () => {
        const workload = createWorkload();

        expect(workload.queueSpec.name).toBe("account-permission-sync");
        expect(workload.concurrency).toBe(2);
        expect(workload.onStarted).toBeTypeOf("function");
        expect(workload.onCompleted).toBeTypeOf("function");
        expect(workload.onTerminalFailure).toBeTypeOf("function");
    });

    test("syncs the requested account", async () => {
        const workload = createWorkload();

        await workload.process(processContext);

        expect(accountFindUniqueOrThrow).toHaveBeenCalledWith({
            where: { id: "account_1" },
            include: { user: true },
        });
        expect(mocks.ensureFreshAccountToken).toHaveBeenCalledWith(account, db);
        expect(mocks.createBitbucketServerClient).toHaveBeenCalledWith(
            "https://bitbucket.example.com",
            undefined,
            "access-token",
        );
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("does not run without the permission syncing entitlement", async () => {
        mocks.hasEntitlement.mockResolvedValue(false);
        const workload = createWorkload();

        await expect(workload.process(processContext)).rejects.toThrow(
            "Permission syncing entitlement is not currently available.",
        );

        expect(accountFindUniqueOrThrow).not.toHaveBeenCalled();
    });

    test("atomically records a reauthentication issue when the refresh token is rejected", async () => {
        const error = tokenRefreshError("refresh_token_rejected", 400);
        mocks.ensureFreshAccountToken.mockRejectedValue(error);
        const workload = createWorkload();

        await expect(workload.process(processContext)).rejects.toBe(error);

        expect(permissionDeleteMany).toHaveBeenCalledWith({
            where: { accountId: "account_1" },
        });
        expect(accountUpdate).toHaveBeenCalledWith({
            where: { id: "account_1" },
            data: {
                permissionSyncIssue: "REAUTHENTICATION_REQUIRED",
                permissionSyncIssueAt: expect.any(Date),
            },
        });
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("records an issue even when permissions were cleared by an earlier attempt", async () => {
        const error = tokenRefreshError("refresh_token_rejected", 400);
        permissionDeleteMany.mockResolvedValue({ count: 0 });
        mocks.ensureFreshAccountToken.mockRejectedValue(error);
        const workload = createWorkload();

        await expect(workload.process(processContext)).rejects.toBe(error);

        expect(accountUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    permissionSyncIssue: "REAUTHENTICATION_REQUIRED",
                }),
            }),
        );
        expect(transaction).toHaveBeenCalledOnce();
    });

    test("records an insufficient-scope issue for scope failures", async () => {
        const error = upstreamError("insufficient_scope");
        mocks.getReposForAuthenticatedBitbucketServerUser.mockRejectedValue(
            error,
        );
        const workload = createWorkload();

        await expect(workload.process(processContext)).rejects.toBe(error);

        expect(accountUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    permissionSyncIssue: "INSUFFICIENT_SCOPE",
                }),
            }),
        );
    });

    test("preserves permissions for a transient refresh failure", async () => {
        const error = tokenRefreshError("transient", 500);
        mocks.ensureFreshAccountToken.mockRejectedValue(error);
        const workload = createWorkload();

        await expect(workload.process(processContext)).rejects.toBe(error);

        expect(permissionDeleteMany).not.toHaveBeenCalled();
        expect(accountUpdate).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });

    test("marks a job as in progress when started", async () => {
        await createWorkload().onStarted?.(lifecycleContext);

        expect(permissionSyncJobUpsert).toHaveBeenCalledWith({
            where: { id: "job_1" },
            update: {
                status: "IN_PROGRESS",
                completedAt: null,
                errorMessage: null,
            },
            create: {
                id: "job_1",
                accountId: "account_1",
                status: "IN_PROGRESS",
            },
        });
    });

    test("marks a job completed and clears the account issue", async () => {
        await createWorkload().onCompleted?.(lifecycleContext, undefined);

        expect(permissionSyncJobUpdate).toHaveBeenCalledWith({
            where: { id: "job_1" },
            data: {
                status: "COMPLETED",
                completedAt: expect.any(Date),
                errorMessage: null,
                account: {
                    update: {
                        permissionSyncedAt: expect.any(Date),
                        permissionSyncIssue: null,
                        permissionSyncIssueAt: null,
                    },
                },
            },
            select: {
                account: {
                    include: { user: true },
                },
            },
        });
    });

    test("marks a job failed after terminal failure", async () => {
        const error = new Error("Upstream unavailable");

        await createWorkload().onTerminalFailure?.(lifecycleContext, error);

        expect(permissionSyncJobUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "job_1" },
                data: {
                    status: "FAILED",
                    completedAt: expect.any(Date),
                    errorMessage: "Upstream unavailable",
                },
            }),
        );
        expect(mocks.captureException).toHaveBeenCalledWith(error, {
            tags: {
                jobId: "job_1",
                queue: "account-permission-sync",
            },
        });
    });
});
