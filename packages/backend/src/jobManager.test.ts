import { describe, expect, test, vi } from 'vitest';

// The module under test creates a logger at import time; stub it so importing pure helpers
// has no side effects (mirrors repoIndexManager.test.ts).
vi.mock('@sourcebot/shared', () => ({
    createLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

// Mock the constants module directly so its env-derived cache-dir paths don't load.
vi.mock('./constants.js', () => ({
    WORKER_STOP_GRACEFUL_TIMEOUT_MS: 5000,
}));

import { normalizeJobState, parseDuration, reconcile } from './jobManager.js';

describe('parseDuration', () => {
    test.each([
        ['500ms', 500],
        ['30s', 30_000],
        ['5m', 300_000],
        ['6h', 21_600_000],
        ['1d', 86_400_000],
    ])('parses %s', (input, expected) => {
        expect(parseDuration(input)).toBe(expected);
    });

    test('trims surrounding whitespace', () => {
        expect(parseDuration('  10m ')).toBe(600_000);
    });

    test.each(['', '5', 'm', '5x', '1.5h', '-5m', '5 m'])('throws on malformed "%s"', (input) => {
        expect(() => parseDuration(input)).toThrow();
    });
});

describe('normalizeJobState', () => {
    test.each([
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
        'paused',
    ])('passes through "%s"', (state) => {
        expect(normalizeJobState(state)).toBe(state);
    });

    test('collapses prioritized and waiting-children to waiting', () => {
        expect(normalizeJobState('prioritized')).toBe('waiting');
        expect(normalizeJobState('waiting-children')).toBe('waiting');
    });

    test('maps anything unrecognized to unknown', () => {
        expect(normalizeJobState('something-else')).toBe('unknown');
        expect(normalizeJobState('unknown')).toBe('unknown');
    });
});

describe('reconcile', () => {
    test('produces a cron workload carrying the given name and schedule', () => {
        const cron = reconcile({
            name: 'x-sweep',
            schedule: { every: '5m' },
            target: 'x',
            scan: async () => [],
        });
        expect(cron.name).toBe('x-sweep');
        expect(cron.schedule).toEqual({ every: '5m' });
    });

    test('handler triggers each scanned item into the target, in order', async () => {
        const triggered: Array<{ workload: string; data: unknown }> = [];
        const cron = reconcile({
            name: 'x-sweep',
            schedule: { pattern: '*/5 * * * *' },
            target: 'x',
            scan: async () => [{ id: 'a' }, { id: 'b' }],
        });

        await cron.handler({
            trigger: async (workload, data) => {
                triggered.push({ workload, data });
            },
        });

        expect(triggered).toEqual([
            { workload: 'x', data: { id: 'a' } },
            { workload: 'x', data: { id: 'b' } },
        ]);
    });

    test('handler triggers nothing when scan returns empty', async () => {
        let calls = 0;
        const cron = reconcile({
            name: 'empty-sweep',
            schedule: { every: '1m' },
            target: 'x',
            scan: async () => [],
        });

        await cron.handler({
            trigger: async () => {
                calls += 1;
            },
        });

        expect(calls).toBe(0);
    });
});
