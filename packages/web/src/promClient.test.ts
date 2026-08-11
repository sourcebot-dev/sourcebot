import { describe, expect, it } from 'vitest';
import { registry } from './promClient';

const metricNames = (output: string): Set<string> => {
    return new Set(
        output
            .split('\n')
            .filter(line => line.length > 0 && !line.startsWith('#'))
            .map(line => line.split(/[ {]/)[0])
    );
};

describe('web promClient', () => {
    it('exposes the metrics needed to diagnose heap pressure', async () => {
        const names = metricNames(await registry.metrics());

        expect(names).toContain('nodejs_heap_size_limit_bytes');
        expect(names).toContain('nodejs_heap_size_used_bytes');
        expect(names).toContain('nodejs_eventloop_lag_p99_seconds');
    });

    it('registers the gc duration histogram', () => {
        // Asserted via the registry rather than the rendered output: the histogram
        // emits no series until a garbage collection has actually been observed.
        expect(registry.getSingleMetric('nodejs_gc_duration_seconds')).toBeDefined();
    });

    it('reports a plausible heap size limit', async () => {
        const output = await registry.metrics();
        const line = output.split('\n').find(l => l.startsWith('nodejs_heap_size_limit_bytes '));

        expect(line).toBeDefined();

        const limit = Number(line!.split(' ')[1]);
        expect(Number.isFinite(limit)).toBe(true);
        // Any real V8 heap limit is well above 100MB and well below 100GB.
        expect(limit).toBeGreaterThan(100 * 1024 * 1024);
        expect(limit).toBeLessThan(100 * 1024 * 1024 * 1024);
    });

    it('can be collected repeatedly', async () => {
        const first = await registry.metrics();
        const second = await registry.metrics();

        expect(metricNames(first)).toEqual(metricNames(second));
    });
});
