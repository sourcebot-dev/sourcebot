import { afterAll, describe, expect, it } from 'vitest';
import { createServer, Server } from 'node:http';
import { startHttpMetrics } from './httpMetrics';
import { registry } from './promClient';

const app = createServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
});

// Stands in for the real metrics server: requests to it must not be recorded,
// since the diagnostics channels are process-wide and would otherwise make
// every scrape observe itself.
const metricsServer = createServer((_req, res) => {
    res.writeHead(200);
    res.end('# metrics');
});

const listen = (server: Server): Promise<number> => {
    return new Promise(resolve => {
        server.listen(0, () => resolve((server.address() as { port: number }).port));
    });
};

afterAll(() => {
    app.close();
    metricsServer.close();
});

const countLines = (output: string): string[] => {
    return output.split('\n').filter(line => line.startsWith('http_request_duration_seconds_count'));
};

describe('httpMetrics', () => {
    it('records durations per normalized route and ignores the metrics port', async () => {
        // Both servers take an ephemeral port, then the metrics port is published
        // to env before subscribing, so the test never depends on a fixed port.
        const metricsPort = await listen(metricsServer);
        const appPort = await listen(app);
        process.env.WEB_METRICS_PORT = String(metricsPort);

        startHttpMetrics();

        await fetch(`http://127.0.0.1:${appPort}/api/health`);
        await fetch(`http://127.0.0.1:${appPort}/browse/github.com/a/b/-/blob/x.ts`);
        await fetch(`http://127.0.0.1:${appPort}/browse/github.com/c/d/-/blob/y.ts`);
        await fetch(`http://127.0.0.1:${metricsPort}/metrics`);

        // The finish channel fires after the response is flushed to the client.
        await new Promise(resolve => setTimeout(resolve, 100));

        const counts = countLines(await registry.metrics());

        expect(counts.some(line => line.includes('route="/api/health"'))).toBe(true);
        expect(counts.some(line => line.includes('status="200"'))).toBe(true);

        // Two distinct file paths must collapse to a single /browse series.
        const browse = counts.filter(line => line.includes('route="/browse"'));
        expect(browse).toHaveLength(1);
        expect(browse[0].trim().endsWith('2')).toBe(true);

        // The scrape of the metrics port must not appear at all.
        expect(counts.some(line => line.includes('route="/metrics"'))).toBe(false);
    });
});
