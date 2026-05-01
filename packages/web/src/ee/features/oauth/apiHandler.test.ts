import { describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { oauthApiHandler } from './apiHandler';

vi.mock('@/lib/posthog', () => ({
    captureEvent: vi.fn(),
}));

const makeRequest = () => new NextRequest('http://localhost/api/ee/oauth/test', { method: 'POST' });

describe('oauthApiHandler', () => {
    test('passes through a 200 response unchanged', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) => Response.json({ ok: true }, { status: 200 }));
        const res = await handler(makeRequest());
        expect(res.status).toBe(200);
    });

    test('passes through a 400 response unchanged', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) => Response.json({ error: 'bad' }, { status: 400 }));
        const res = await handler(makeRequest());
        expect(res.status).toBe(400);
    });

    test('passes through a 302 redirect unchanged', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) =>
            new Response(null, { status: 302, headers: { Location: '/elsewhere' } })
        );
        const res = await handler(makeRequest());
        expect(res.status).toBe(302);
    });

    test('passes through a 303 redirect unchanged (the spec-recommended status)', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) =>
            new Response(null, { status: 303, headers: { Location: '/elsewhere' } })
        );
        const res = await handler(makeRequest());
        expect(res.status).toBe(303);
    });

    test('throws when the inner handler returns 307', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) =>
            new Response(null, { status: 307, headers: { Location: '/elsewhere' } })
        );
        await expect(handler(makeRequest())).rejects.toThrow(/RFC 9700/);
    });

    test('throws when the inner handler returns 308', async () => {
        const handler = oauthApiHandler(async (_req: NextRequest) =>
            new Response(null, { status: 308, headers: { Location: '/elsewhere' } })
        );
        await expect(handler(makeRequest())).rejects.toThrow(/RFC 9700/);
    });
});
