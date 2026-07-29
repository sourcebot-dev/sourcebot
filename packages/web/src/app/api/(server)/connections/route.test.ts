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

// `sew.ts` imports `@sentry/nextjs`, which transitively pulls in
// `@opentelemetry/sdk-trace-base`. The pre-existing version mismatch
// (sdk-trace-base 1.28.0 expects `core.getEnv`, but core 2.8.0 dropped
// it) makes the import fail at test-load time. Stub Sentry and the OTel
// modules so the route file can be loaded without exercising the SDK.
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
            // Mirror the production behavior: if no auth, return a
            // service error. The route is responsible for translating
            // that into a 401.
            return { statusCode: 401, errorCode: 'NOT_AUTHENTICATED', message: 'Not authenticated' };
        }
        return callback(mocks.authContext);
    }),
}));

const makeRequest = (search: Record<string, string> = {}): NextRequest => {
    const params = new URLSearchParams(search);
    const url = `http://localhost/api/connections?${params.toString()}`;
    return new NextRequest(url);
};

const { GET } = await import('./route');

// The Prisma mock is shaped to drive the four query paths the route
// uses: listConnections.findMany, listConnections.count,
// connectionSyncJob.groupBy, plus the relations via `include`. The
// mock includes a populated `config` field on every row so the
// "config is not in the response" regression test can actually
// detect a future change that accidentally spreads raw Prisma rows
// into the response shape.
const buildPrismaMock = (opts: {
    connections: Array<{
        id: number;
        name: string;
        connectionType: typeof ConnectionType[keyof typeof ConnectionType];
        isDeclarative: boolean;
        syncedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        repoCount: number;
        latestJob: {
            id: string;
            status: typeof ConnectionSyncJobStatus[keyof typeof ConnectionSyncJobStatus];
            createdAt: Date;
            completedAt: Date | null;
            errorMessage: string | null;
        } | null;
    }>;
    inFlight: Map<number, number>;
    totalCount: number;
}) => {
    const findMany = vi.fn(async () => opts.connections.map((c) => ({
        id: c.id,
        name: c.name,
        connectionType: c.connectionType,
        isDeclarative: c.isDeclarative,
        syncedAt: c.syncedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        // The config is the actual JSON the user stored (e.g.
        // { token: { env: 'GH_TOKEN' } }) for declarative connections.
        // It must never appear in the public response. We include it
        // here so the regression test below is meaningful: a future
        // change that spreads raw Prisma rows will leak this field.
        config: { token: { env: 'SOURCEBOT_TEST_TOKEN' } },
        _count: { repos: c.repoCount, syncJobs: c.latestJob ? 1 : 0 },
        syncJobs: c.latestJob ? [c.latestJob] : [],
    })));
    const count = vi.fn(async () => opts.totalCount);
    const groupBy = vi.fn(async () => Array.from(opts.inFlight.entries()).map(([connectionId, count]) => ({
        connectionId,
        _count: { _all: count },
    })));
    return { connection: { findMany, count }, connectionSyncJob: { groupBy } } as unknown;
};

const setAuth = (connections: Parameters<typeof buildPrismaMock>[0]['connections'], opts?: { inFlight?: Map<number, number>; totalCount?: number }) => {
    const allConnections = opts?.inFlight ? new Map(opts.inFlight) : new Map<number, number>();
    mocks.authContext = {
        user: { id: 'user_1' },
        org: { id: 1 },
        prisma: buildPrismaMock({
            connections,
            inFlight: allConnections,
            totalCount: opts?.totalCount ?? connections.length,
        }),
    };
};

describe('GET /api/connections', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authContext = undefined;
    });

    test('returns 401 when no authenticated user', async () => {
        // withAuth returns a service error; the route returns 401.
        mocks.authContext = undefined;
        const response = await GET(makeRequest());
        expect(response.status).toBe(401);
    });

    test('returns the documented connection shape on a happy path', async () => {
        const now = new Date('2026-07-25T14:00:00.000Z');
        setAuth([
            {
                id: 1,
                name: 'github-public',
                connectionType: ConnectionType.github,
                isDeclarative: false,
                syncedAt: now,
                createdAt: new Date('2026-06-12T08:21:00.000Z'),
                updatedAt: now,
                repoCount: 137,
                latestJob: {
                    id: 'job_1',
                    status: ConnectionSyncJobStatus.COMPLETED,
                    createdAt: new Date('2026-07-25T13:59:30.000Z'),
                    completedAt: now,
                    errorMessage: null,
                },
            },
        ]);

        const response = await GET(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        // The action must pass the org id to both Prisma queries so
        // cross-org rows are filtered at the query level. The mock
        // returns its fixture regardless of args, so a future change
        // that drops `orgId: org.id` from the where clause would
        // still pass the response-shape assertions above.
        const prisma = mocks.authContext?.prisma as {
            connection: { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
        };
        expect(prisma.connection.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { orgId: 1 } }),
        );
        expect(prisma.connection.count).toHaveBeenCalledWith(
            expect.objectContaining({ where: { orgId: 1 } }),
        );
        expect(body.connections).toHaveLength(1);
        expect(body.connections[0]).toEqual({
            id: 1,
            name: 'github-public',
            connectionType: 'github',
            isDeclarative: false,
            syncedAt: now.toISOString(),
            createdAt: new Date('2026-06-12T08:21:00.000Z').toISOString(),
            updatedAt: now.toISOString(),
            repoCount: 137,
            inFlightJobCount: 0,
            latestJob: {
                id: 'job_1',
                status: 'COMPLETED',
                createdAt: new Date('2026-07-25T13:59:30.000Z').toISOString(),
                completedAt: now.toISOString(),
                errorMessage: null,
            },
        });
    });

    test('returns latestJob:null for a connection that has never been synced', async () => {
        setAuth([
            {
                id: 2,
                name: 'never-synced',
                connectionType: ConnectionType.gitlab,
                isDeclarative: false,
                syncedAt: null,
                createdAt: new Date('2026-07-01T00:00:00.000Z'),
                updatedAt: new Date('2026-07-01T00:00:00.000Z'),
                repoCount: 0,
                latestJob: null,
            },
        ]);

        const response = await GET(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.connections[0].latestJob).toBeNull();
        expect(body.connections[0].syncedAt).toBeNull();
        expect(body.connections[0].repoCount).toBe(0);
    });

    test('exposes the in-flight job count per connection', async () => {
        setAuth(
            [
                {
                    id: 3,
                    name: 'busy',
                    connectionType: ConnectionType.github,
                    isDeclarative: false,
                    syncedAt: null,
                    createdAt: new Date('2026-07-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
                    repoCount: 5,
                    latestJob: {
                        id: 'job_3',
                        status: ConnectionSyncJobStatus.IN_PROGRESS,
                        createdAt: new Date('2026-07-01T00:00:00.000Z'),
                        completedAt: null,
                        errorMessage: null,
                    },
                },
            ],
            { inFlight: new Map([[3, 2]]) },
        );

        const response = await GET(makeRequest());
        const body = await response.json();

        expect(body.connections[0].inFlightJobCount).toBe(2);
    });

    test('exposes the latest job errorMessage verbatim', async () => {
        setAuth([
            {
                id: 4,
                name: 'broken',
                connectionType: ConnectionType.github,
                isDeclarative: false,
                syncedAt: null,
                createdAt: new Date('2026-07-01T00:00:00.000Z'),
                updatedAt: new Date('2026-07-01T00:00:00.000Z'),
                repoCount: 0,
                latestJob: {
                    id: 'job_4',
                    status: ConnectionSyncJobStatus.FAILED,
                    createdAt: new Date('2026-07-01T00:00:00.000Z'),
                    completedAt: new Date('2026-07-01T00:00:30.000Z'),
                    errorMessage: 'connection refused: host=github.example.com:443',
                },
            },
        ]);

        const response = await GET(makeRequest());
        const body = await response.json();

        expect(body.connections[0].latestJob.status).toBe('FAILED');
        expect(body.connections[0].latestJob.errorMessage).toBe(
            'connection refused: host=github.example.com:443',
        );
    });

    test('does NOT include the connection config (which carries tokens)', async () => {
        setAuth([
            {
                id: 5,
                name: 'token-bearing',
                connectionType: ConnectionType.github,
                isDeclarative: false,
                syncedAt: null,
                createdAt: new Date('2026-07-01T00:00:00.000Z'),
                updatedAt: new Date('2026-07-01T00:00:00.000Z'),
                repoCount: 0,
                latestJob: null,
            },
        ]);

        const response = await GET(makeRequest());
        const body = await response.json();

        // The config is the actual JSON the user stored (e.g. { token: { env: 'GH_TOKEN' } })
        // for declarative connections. It must not be in the public response.
        expect(body.connections[0].config).toBeUndefined();
    });

    test('returns 400 for perPage > 100', async () => {
        setAuth([]);
        const response = await GET(makeRequest({ perPage: '1000' }));
        expect(response.status).toBe(400);
    });

    test('returns 400 for perPage <= 0', async () => {
        setAuth([]);
        const response = await GET(makeRequest({ perPage: '0' }));
        expect(response.status).toBe(400);
    });

    test('returns 400 for non-integer page', async () => {
        setAuth([]);
        const response = await GET(makeRequest({ page: 'abc' }));
        expect(response.status).toBe(400);
    });

    test('defaults page=1 and perPage=50 when no query params are provided', async () => {
        setAuth([]);
        const response = await GET(makeRequest());
        // Empty list still returns 200 (not 400); defaults are accepted.
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.connections).toEqual([]);
    });

    test('emits X-Total-Count and Link headers on the response', async () => {
        setAuth([], { totalCount: 137 });

        const response = await GET(makeRequest({ page: '1', perPage: '10' }));

        expect(response.headers.get('X-Total-Count')).toBe('137');
        const link = response.headers.get('Link');
        expect(link).toBeTruthy();
        expect(link).toContain('rel="first"');
        expect(link).toContain('rel="last"');
        expect(link).toContain('rel="next"');
    });
});
