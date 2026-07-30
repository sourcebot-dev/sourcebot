import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { OrgRole } from '@sourcebot/db';

type AuthContext = {
    user: { id: string };
    org: { id: number };
    role: OrgRole;
    prisma: unknown;
};

const mocks = vi.hoisted(() => ({
    authContext: undefined as AuthContext | undefined,
    findFirst: vi.fn(),
    workerResponse: undefined as { ok: boolean; status: number; json: () => Promise<unknown> } | undefined,
}));

vi.mock('server-only', () => ({}));

vi.mock('@sourcebot/db', () => ({
    OrgRole: { MEMBER: 'MEMBER', OWNER: 'OWNER' },
}));

vi.mock('@sourcebot/shared', () => ({
    env: { WORKER_API_URL: 'http://worker.example.com' },
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

const setAuth = (opts: {
    role?: OrgRole;
    connectionExists?: boolean;
}) => {
    mocks.findFirst.mockImplementation(async () => opts.connectionExists ? { id: 1 } : null);
    mocks.authContext = {
        user: { id: 'user_1' },
        org: { id: 1 },
        role: opts.role ?? OrgRole.OWNER,
        prisma: { connection: { findFirst: mocks.findFirst } },
    };
};

const makeRequest = (id: string): NextRequest =>
    new NextRequest(`http://localhost/api/connections/${id}/sync`, { method: 'POST' });

const { POST } = await import('./route');

// Mock the global fetch that the action uses to call the worker.
const originalFetch = globalThis.fetch;
beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn(async () => {
        if (!mocks.workerResponse) {
            throw new Error('workerResponse not set');
        }
        return new Response(JSON.stringify(await mocks.workerResponse.json()), {
            status: mocks.workerResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as typeof fetch;
    mocks.authContext = undefined;
    mocks.workerResponse = undefined;
});

// Restore the original fetch when the suite finishes so other test
// files are not affected.
afterAll(() => {
    globalThis.fetch = originalFetch;
});

describe('POST /api/connections/:id/sync', () => {
    test('returns 401 when no authenticated user', async () => {
        mocks.authContext = undefined;
        const response = await POST(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(401);
    });

    test('returns 403 when the caller is a MEMBER (not OWNER)', async () => {
        setAuth({ role: OrgRole.MEMBER, connectionExists: true });
        const response = await POST(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(403);
        // The worker must not be called when the caller is a MEMBER.
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('returns 400 when id is not a positive integer', async () => {
        setAuth({ role: OrgRole.OWNER, connectionExists: false });
        const response = await POST(makeRequest('abc'), { params: Promise.resolve({ id: 'abc' }) });
        expect(response.status).toBe(400);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('returns 400 when id is zero or negative', async () => {
        setAuth({ role: OrgRole.OWNER, connectionExists: false });
        const response = await POST(makeRequest('0'), { params: Promise.resolve({ id: '0' }) });
        expect(response.status).toBe(400);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('returns 404 when the connection does not exist in the org', async () => {
        setAuth({ role: OrgRole.OWNER, connectionExists: false });
        const response = await POST(makeRequest('999'), { params: Promise.resolve({ id: '999' }) });
        expect(response.status).toBe(404);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('returns 404 (not 403) for cross-org access to avoid leaking existence', async () => {
        // The mock returns null for `connectionExists: false` regardless
        // of which id is requested, simulating the case where the
        // connection lives in a different org and is therefore invisible
        // to the current org. The action scopes by `where: { id, orgId }`
        // so cross-org ids collapse to "not found", same as the detail
        // endpoint.
        setAuth({ role: OrgRole.OWNER, connectionExists: false });
        const response = await POST(makeRequest('42'), { params: Promise.resolve({ id: '42' }) });
        expect(response.status).toBe(404);
        // Assert that the action scoped the query by orgId. A future
        // change that drops the orgId filter would still pass the 404
        // assertion (mock returns null regardless of args) but would
        // expose cross-org data in production.
        expect(mocks.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 42, orgId: 1 } }),
        );
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test('returns 202 with the new jobId on the happy path', async () => {
        setAuth({ role: OrgRole.OWNER, connectionExists: true });
        mocks.workerResponse = {
            ok: true,
            status: 200,
            json: async () => ({ jobId: 'job_abc' }),
        };

        const response = await POST(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        const body = await response.json();

        expect(response.status).toBe(202);
        expect(body).toEqual({ jobId: 'job_abc' });

        // The action called the worker with the connectionId in the body.
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://worker.example.com/api/sync-connection',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ connectionId: 1 }),
            }),
        );
    });

    test('returns 500 when the worker returns a non-ok response', async () => {
        setAuth({ role: OrgRole.OWNER, connectionExists: true });
        mocks.workerResponse = {
            ok: false,
            status: 500,
            json: async () => ({ error: 'worker exploded' }),
        } as unknown as { ok: boolean; status: number; json: () => Promise<unknown> };

        const response = await POST(makeRequest('1'), { params: Promise.resolve({ id: '1' }) });
        expect(response.status).toBe(500);
    });
});
