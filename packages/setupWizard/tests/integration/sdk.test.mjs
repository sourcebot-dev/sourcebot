import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { gunzipSync } from 'node:zlib';
import { PostHog } from 'posthog-node';
import { Telemetry, POSTHOG_OPTIONS } from '../../dist/telemetry.js';

test('real SDK transport envelope keeps its permitted metadata and identity', async () => {
    const requests = [];
    const server = createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        requests.push(JSON.parse((req.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes).toString()));
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":1}');
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
        const telemetry = new Telemetry(() => new PostHog('phc_test', { ...POSTHOG_OPTIONS, host: `http://127.0.0.1:${server.address().port}` }));
        telemetry.capture('started', { invocationMethod: 'unknown', isInteractive: true });
        telemetry.capture('cancelled', { stage: 'setup_directory', reason: 'keyboard_interrupt' });
        await telemetry.shutdown();
        const events = requests.flatMap(r => r.batch);
        assert.equal(events.length, 2);
        assert.ok(Date.parse(events[1].timestamp) > Date.parse(events[0].timestamp));
        for (const e of events) {
            assert.equal(e.distinct_id, telemetry.setupSessionId);
            assert.equal(e.properties.install_id, telemetry.setupSessionId);
            assert.deepEqual(e.properties.$groups, { company: telemetry.setupSessionId });
            assert.equal(e.properties.$lib, 'posthog-node');
            assert.equal(e.properties.$lib_version, '5.52.1');
            assert.equal(e.properties.$geoip_disable, true);
            assert.equal(e.properties.$ignore_sent_at, true);
            assert.equal(e.properties.$is_server, undefined);
            assert.equal(e.properties.$process_person_profile, undefined);
            assert.equal(e.properties.$set, undefined);
            assert.ok(!Number.isNaN(Date.parse(e.timestamp)));
            assert.match(e.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        }
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
