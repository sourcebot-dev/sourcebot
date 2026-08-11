import client, { Gauge, Histogram, Registry } from 'prom-client';
import { getHeapStatistics } from 'node:v8';

export const registry = new Registry();

export const httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests handled by the web server, in seconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});
registry.registerMetric(httpRequestDuration);

// `collectDefaultMetrics` reports heap usage but not the ceiling it's measured
// against, and usage alone can't distinguish "busy" from "out of room". Without
// the limit there's no way to tell whether V8 is doing cheap incremental
// collections or is pinned at its ceiling running full mark-compacts.
const heapSizeLimit = new Gauge({
    name: 'nodejs_heap_size_limit_bytes',
    help: 'V8 heap size limit in bytes',
    collect() {
        this.set(getHeapStatistics().heap_size_limit);
    },
});
registry.registerMetric(heapSizeLimit);

client.collectDefaultMetrics({
    register: registry,
});
