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
        const wallClockNow = Date.now();
        const response = await GET(makeRequest());
        const body = await response.json();

        const startedAtMs = Date.parse(body.startedAt);
        expect(Number.isNaN(startedAtMs)).toBe(false);
        // `startedAt` is derived from process boot via `process.uptime()`,
        // not module-load wall time. It must be in the past and
        // consistent with the process-uptime clock; the consistency
        // window is enforced by the dedicated test below.
        expect(startedAtMs).toBeLessThanOrEqual(wallClockNow);
        // Sanity: process started sometime in the last 30 days. A
        // 30-day window is wide enough to not be flaky on long-lived
        // CI workers but tight enough to fail on a literal "1970"
        // start time.
        expect(startedAtMs).toBeGreaterThan(wallClockNow - 30 * 24 * 60 * 60 * 1000);
    });

    test('exposes a non-negative integer uptime', async () => {
        const response = await GET(makeRequest());
        const body = await response.json();

        expect(typeof body.uptime).toBe('number');
        expect(Number.isInteger(body.uptime)).toBe(true);
        expect(body.uptime).toBeGreaterThanOrEqual(0);
    });

    test('uptime is anchored to process boot, not module load', async () => {
        // The route is supposed to expose the process uptime
        // (`process.uptime()`), not the time since the module was
        // first imported. A freshly imported module would report a
        // tiny uptime; a long-running process should report a larger
        // one even on the first request. We assert that the reported
        // uptime is within a small window of the live `process.uptime()`
        // and that the test environment is consistent across two calls.
        const first = (await (await GET(makeRequest())).json()).uptime as number;
        // process.uptime() and the route's uptime are both derived from
        // the same monotonic clock, so they should match within a 1s
        // floor error.
        expect(Math.abs(first - Math.floor(process.uptime()))).toBeLessThanOrEqual(1);
    });

    test('uptime increases between two requests', async () => {
        const first = (await (await GET(makeRequest())).json()).uptime as number;
        // Sleep 1.1s so the floor(process.uptime()) tick is observable
        // even on a slow runner.
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const second = (await (await GET(makeRequest())).json()).uptime as number;

        expect(second).toBeGreaterThan(first);
    });

    test('startedAt is consistent with the process-start estimate', async () => {
        // startedAt should match Date.now() - uptime*1000 to within a
        // 1500ms window (rounding from `Math.floor` on both sides).
        const body = await (await GET(makeRequest())).json();
        const startedAtMs = Date.parse(body.startedAt);
        const wallClockNow = Date.now();
        const estimatedNow = startedAtMs + body.uptime * 1000;
        // Allow 1.5s of slack for the per-second floor on both sides.
        expect(Math.abs(wallClockNow - estimatedNow)).toBeLessThan(1500);
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
