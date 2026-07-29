import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

type AuthContext = {
    user: { id: string };
    org: { id: number };
    prisma: unknown;
};

// Lightweight stand-ins for the Prisma enums. Re-exported as the same
// names so the route's `z.nativeEnum(...)` validation accepts the test
// values. The real enums live in `@sourcebot/db`; we mock that package
// to keep the OpenTelemetry CJS chain out of the test load path.
const ConnectionSyncJobStatus = {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
} as const;

const CodeHostType = {
    github: 'github',
    gitlab: 'gitlab',
    gitea: 'gitea',
    gerrit: 'gerrit',
    bitbucketServer: 'bitbucket-server',
    bitbucketCloud: 'bitbucket-cloud',
    genericGitHost: 'generic-git-host',
    azuredevops: 'azuredevops',
} as const;

// The Prisma enum is its own runtime object, not a type alias. We
// mirror the values so `z.nativeEnum(ConnectionType)` at the route's
// load time picks up the right keys.
const ConnectionType = {
    github: 'github',
    gitlab: 'gitlab',
    gitea: 'gitea',
    gerrit: 'gerrit',
    bitbucketServer: 'bitbucket-server',
    bitbucketCloud: 'bitbucket-cloud',
    genericGitHost: 'generic-git-host',
    azuredevops: 'azuredevops',
} as const;

const mocks = vi.hoisted(() => ({
    authContext: undefined as AuthContext | undefined,
}));

vi.mock('server-only', () => ({}));

vi.mock('@sourcebot/db', () => ({
    ConnectionSyncJobStatus,
    ConnectionType,
    CodeHostType,
}));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));

vi.mock('@/middleware/withAuth', () => ({
    withAuth: vi.fn(async (callback: (ctx: AuthContext) => unknown) => {
        if (!mocks.authContext) {
            return { statusCode: 401, errorCode: 'NOT_AUTHENTICATED', message: 'Not authenticated' };
        }
        return callback(mocks.authContext);
    }),
}));

vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
    captureRequestError: vi.fn(),
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
    getEnv: () => ({}),
    TraceIdRatioBasedSampler: vi.fn(),
    ParentBasedSampler: vi.fn(),
    AlwaysOnSampler: vi.fn(),
    AlwaysOffSampler: vi.fn(),
}));

const makeRequest = (id: string, search: Record<string, string> = {}): NextRequest => {
    const params = new URLSearchParams(search);
    const url = `http://localhost/api/connections/${id}?${params.toString()}`;
    return new NextRequest(url);
};

const { GET } = await import('./route');

// The Prisma mock is shaped to drive the four query paths the action
// uses: connection.findFirst (with orgId scope + _count.repos), the
// recent-jobs findMany, and the in-flight groupBy. The connection
// row includes a populated `config` field so the regression test
// below is meaningful: a future change that spreads raw Prisma rows
// will leak this field, and the test catches it.
type JobFixture = {
    id: string;
    status: keyof typeof ConnectionSyncJobStatus;
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    warningMessages: string[];
};

const buildPrismaMock = (opts: {
    connection:
        | (Omit<{
            id: number;
            name: string;
            connectionType: keyof typeof ConnectionType;
            isDeclarative: boolean;
            syncedAt: Date | null;
            createdAt: Date;
            updatedAt: Date;
            _count: { repos: number };
        }, never> & { config: unknown })
        | null;
    recentJobs: JobFixture[];
    inFlightCount: number;
}) => {
    const findFirst = vi.fn(async () => opts.connection);
    const findMany = vi.fn(async () => opts.recentJobs);
    const groupBy = vi.fn(async () => opts.inFlightCount > 0
        ? [{ connectionId: opts.connection?.id ?? 0, _count: { _all: opts.inFlightCount } }]
        : []);
    return {
        connection: { findFirst },
        connectionSyncJob: { findMany, groupBy },
    } as unknown;
};

const setAuth = (
    connection: Parameters<typeof buildPrismaMock>[0]['connection'],
    recentJobs: JobFixture[] = [],
    inFlightCount = 0,
) => {
    mocks.authContext = {
        user: { id: 'user_1' },
        org: { id: 1 },
        prisma: buildPrismaMock({ connection, recentJobs, inFlightCount }),
    };
};

const fakeCompletedAt = (createdAt: Date) => new Date(createdAt.getTime() + 30_000);

describe('GET /api/connections/:id', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authContext = undefined;
    });

    test('returns 401 when no authenticated user', async () => {
        mocks.authContext = undefined;
        const response = await GET(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(401);
    });

    test('returns 400 when id is not a positive integer', async () => {
        setAuth(null);
        const response = await GET(makeRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
        expect(response.status).toBe(400);
    });

    test('returns 400 when id is zero or negative', async () => {
        setAuth(null);
        const response = await GET(makeRequest('0'), { params: Promise.resolve({ id: '0' }) });
        expect(response.status).toBe(400);
    });

    test('returns 404 when the connection does not exist in the org', async () => {
        setAuth(null);
        const response = await GET(makeRequest('999'), { params: Promise.resolve({ id: '999' }) });
        expect(response.status).toBe(404);
    });

    test('returns 200 with the documented shape on a happy path', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        const completedAt = fakeCompletedAt(createdAt);
        setAuth(
            {
                id: 1,
                name: 'github-public',
                connectionType: 'github',
                isDeclarative: false,
                syncedAt: completedAt,
                createdAt: new Date('2026-06-12T08:21:00.000Z'),
                updatedAt: completedAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
            [
                {
                    id: 'job_1',
                    status: 'COMPLETED',
                    createdAt,
                    completedAt,
                    errorMessage: null,
                    warningMessages: [],
                },
            ],
            0,
        );

        const response = await GET(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        // The action must pass the org id to Prisma so cross-org rows
        // are filtered at the query level (the 404 path test above
        // already exercises the not-found branch; this asserts the
        // happy path also scopes the query).
        const prisma = mocks.authContext?.prisma as {
            connection: { findFirst: ReturnType<typeof vi.fn> };
        };
        expect(prisma.connection.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 1, orgId: 1 },
            }),
        );
        expect(body.connection).toEqual({
            id: 1,
            name: 'github-public',
            connectionType: 'github',
            isDeclarative: false,
            syncedAt: completedAt.toISOString(),
            createdAt: new Date('2026-06-12T08:21:00.000Z').toISOString(),
            updatedAt: completedAt.toISOString(),
            repoCount: 0, // _count.repos: 0
            inFlightJobCount: 0,
            latestJob: {
                id: 'job_1',
                status: 'COMPLETED',
                createdAt: createdAt.toISOString(),
                completedAt: completedAt.toISOString(),
                durationMs: 30000,
                errorMessage: null,
                warningMessages: [],
            },
        });
        expect(body.recentJobs).toHaveLength(1);
    });

    test('does NOT include the connection config (which carries tokens)', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        setAuth(
            {
                id: 5,
                name: 'token-bearing',
                connectionType: 'github',
                isDeclarative: false,
                syncedAt: null,
                createdAt,
                updatedAt: createdAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
        );

        const response = await GET(makeRequest('5'), { params: Promise.resolve({ id: '5' }) });
        const body = await response.json();

        expect(body.connection.config).toBeUndefined();
    });

    test('exposes the latest job errorMessage and warningMessages verbatim', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        const completedAt = fakeCompletedAt(createdAt);
        setAuth(
            {
                id: 1,
                name: 'broken',
                connectionType: 'github',
                isDeclarative: false,
                syncedAt: null,
                createdAt,
                updatedAt: completedAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
            [
                {
                    id: 'job_42',
                    status: 'FAILED',
                    createdAt,
                    completedAt,
                    errorMessage: 'connection refused: host=github.example.com:443',
                    warningMessages: ['8 repos were skipped: 404 not found'],
                },
            ],
        );

        const response = await GET(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        const body = await response.json();

        expect(body.recentJobs[0].errorMessage).toBe(
            'connection refused: host=github.example.com:443',
        );
        expect(body.recentJobs[0].warningMessages).toEqual([
            '8 repos were skipped: 404 not found',
        ]);
    });

    test('forwards jobLimit to Prisma as the findMany `take`', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        const completedAt = fakeCompletedAt(createdAt);
        const jobs: JobFixture[] = Array.from({ length: 5 }, (_, i) => ({
            id: `job_${i}`,
            status: 'COMPLETED' as const,
            createdAt: new Date(createdAt.getTime() - i * 60_000),
            completedAt: new Date(createdAt.getTime() - i * 60_000 + 30_000),
            errorMessage: null,
            warningMessages: [],
        }));
        setAuth(
            {
                id: 1,
                name: 'busy',
                connectionType: 'github',
                isDeclarative: false,
                syncedAt: null,
                createdAt,
                updatedAt: completedAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
            jobs,
        );

        const response = await GET(
            makeRequest('1', { jobLimit: '2' }),
            { params: Promise.resolve({ id: '1' }) },
        );
        const body = await response.json();

        // The mock returns whatever the test sets; the meaningful
        // assertion is that the action passed the parsed jobLimit
        // through to the recent-jobs findMany.
        const prisma = mocks.authContext?.prisma as {
            connectionSyncJob: { findMany: ReturnType<typeof vi.fn> };
        };
        expect(prisma.connectionSyncJob.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ take: 2, orderBy: { createdAt: 'desc' } }),
        );
        expect(body.recentJobs).toHaveLength(5);
    });

    test('returns 400 for jobLimit=0', async () => {
        setAuth(null);
        const response = await GET(
            makeRequest('1', { jobLimit: '0' }),
            { params: Promise.resolve({ id: '1' }) },
        );
        expect(response.status).toBe(400);
    });

    test('returns 400 for jobLimit > 50', async () => {
        setAuth(null);
        const response = await GET(
            makeRequest('1', { jobLimit: '51' }),
            { params: Promise.resolve({ id: '1' }) },
        );
        expect(response.status).toBe(400);
    });

    test('returns 200 with empty recentJobs for a connection that has never been synced', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        setAuth(
            {
                id: 2,
                name: 'never-synced',
                connectionType: 'gitlab',
                isDeclarative: false,
                syncedAt: null,
                createdAt,
                updatedAt: createdAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
            [],
        );

        const response = await GET(makeRequest('2'), { params: Promise.resolve({ id: '2' }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.connection.syncedAt).toBeNull();
        expect(body.connection.latestJob).toBeNull();
        expect(body.recentJobs).toEqual([]);
    });

    test('populates inFlightJobCount from the groupBy query', async () => {
        const createdAt = new Date('2026-07-25T13:59:30.000Z');
        setAuth(
            {
                id: 3,
                name: 'busy',
                connectionType: 'github',
                isDeclarative: false,
                syncedAt: null,
                createdAt,
                updatedAt: createdAt,
                _count: { repos: 0 },
                config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
            },
            [],
            2, // inFlightCount
        );

        const response = await GET(makeRequest('3'), { params: Promise.resolve({ id: '3' }) });
        const body = await response.json();

        expect(body.connection.inFlightJobCount).toBe(2);
    });

    test('cross-org access returns 404 (not 403) to avoid leaking existence', async () => {
        // The action scopes by `where: { id, orgId: org.id }`. If the
        // connection is in another org, findFirst returns null, and the
        // route returns 404 — not 403. This is the security-critical
        // assertion: a 403 here would tell an attacker that the id
        // exists in some other org.
        setAuth(null);
        const response = await GET(makeRequest('42'), { params: Promise.resolve({ id: '42' }) });
        expect(response.status).toBe(404);

        // Beyond the response code, assert that the action actually
        // passed the org id to Prisma. A future change that drops
        // `orgId: org.id` from the `where` clause would still pass the
        // 404 assertion (because the mock returns null regardless of
        // args) but would expose cross-org data in production.
        const prisma = mocks.authContext?.prisma as {
            connection: { findFirst: ReturnType<typeof vi.fn> };
        };
        expect(prisma.connection.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 42, orgId: 1 },
            }),
        );
    });
});
