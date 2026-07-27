import { beforeEach, describe, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockSourcebotVersion = 'v9.9.9-test';

vi.mock('server-only', () => ({}));

vi.mock('@sourcebot/shared', () => ({
    SOURCEBOT_VERSION: mockSourcebotVersion,
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

const { GET } = await import('./route');

const makeRequest = (): NextRequest => new NextRequest('http://localhost/api/health');

describe('GET /api/health', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns 200 with the enriched process-info shape', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(response.status).toBe(200);
        // Existing field is preserved so K8s livenessProbe configs that
        // only check the HTTP code keep working, and so do older scripts
        // that parse {status:"ok"}.
        expect(body.status).toBe('ok');
    });

    test('exposes the Sourcebot version', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(body.version).toBe(mockSourcebotVersion);
    });

    test('exposes a parseable ISO 8601 startedAt in the past', async () => {
        const now = Date.now();
        const response = await GET(makeRequest());
        const body = await response.json();

        const startedAtMs = Date.parse(body.startedAt);
        expect(Number.isNaN(startedAtMs)).toBe(false);
        // `startedAt` is captured at module load, which happens during
        // the import at the top of this file. It must be in the past
        // and reasonably recent (sanity-bounds to "not 1970").
        expect(startedAtMs).toBeLessThanOrEqual(now);
        expect(startedAtMs).toBeGreaterThan(now - 60 * 60 * 1000);
    });

    test('exposes a non-negative integer uptime', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(typeof body.uptime).toBe('number');
        expect(Number.isInteger(body.uptime)).toBe(true);
        expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('uptime increases between two requests', async () => {
        const first = (await (await GET(makeRequest())).json()).uptime as number;
        // Sleep 1.1s so the floor((Date.now() - startedAtMs) / 1000) tick
        // is observable even on a slow runner.
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const second = (await (await GET(makeRequest())).json()).uptime as number;

        expect(second).toBeGreaterThan(first);
    });

    test('exposes Node process facts (version, platform, arch)', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(body.node).toEqual({
            version: process.version,
            platform: process.platform,
            arch: process.arch,
        });
    });

    test('exposes the Node process pid', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(body.pid).toBe(process.pid);
    });
});
