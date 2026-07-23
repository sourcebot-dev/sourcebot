import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@sourcebot/shared', () => ({
    env: { WORKER_API_URL: 'http://worker.example.com' },
}));

const { requestAccountPermissionSync } = await import('./client.server');

beforeEach(() => {
    vi.unstubAllGlobals();
});

describe('requestAccountPermissionSync', () => {
    test('schedules an account permission sync with the worker', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ jobId: 'job_1' }),
            { status: 200 },
        ));
        vi.stubGlobal('fetch', fetchMock);

        await expect(requestAccountPermissionSync('account_1')).resolves.toEqual({ jobId: 'job_1' });
        expect(fetchMock).toHaveBeenCalledWith(
            'http://worker.example.com/api/trigger-account-permission-sync',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ accountId: 'account_1' }),
            }),
        );
    });

    test('rejects when the worker does not accept the sync request', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

        await expect(requestAccountPermissionSync('account_1'))
            .rejects.toThrow('Worker rejected account permission sync with HTTP 503.');
    });
});
