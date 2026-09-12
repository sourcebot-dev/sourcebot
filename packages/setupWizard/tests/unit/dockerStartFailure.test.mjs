import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DockerStartFailure } from '../../dist/dockerStartFailure.js';
import { Lifecycle } from '../../dist/lifecycle.js';
import { eventSchemas, validateFields } from '../../dist/telemetryEvents.js';

test('Docker reasons are bounded, chunk-safe, ANSI-safe and never contain runtime text', () => {
    const classifier = new DockerStartFailure();
    const message = '\u001b[31mError response from daemon: Conflict. The container name "/secret" is already in use by container "secret-id".\u001b[0m';
    for (const char of message) classifier.write(Buffer.from(char));
    assert.equal(classifier.reason(), 'container_name_conflict');
    const huge = new DockerStartFailure();
    huge.write(Buffer.from('secret'.repeat(100000)));
    assert.ok(huge.pending.length <= 8192);
    assert.equal(huge.reason(), 'unknown');
    const props = { failurePhase: 'compose_exit', failureCategory: 'docker_command', failureReason: 'unknown', stderr: message };
    assert.deepEqual(Object.keys(validateFields(eventSchemas.start_failed, props)).sort(), ['failureCategory', 'failurePhase', 'failureReason']);
    assert.throws(() => validateFields(eventSchemas.start_failed, { ...props, failureReason: message }));
});

test('only one start diagnostic may follow completion; SDK stays open until process cleanup', async () => {
    const events = [];
    let shutdowns = 0;
    const life = new Lifecycle({ capture: (name, props) => events.push({ name, props }), shutdown: async () => { shutdowns++; } });
    await life.complete({}, true);
    assert.equal(shutdowns, 0);
    assert.equal(life.terminal, 'completed');
    const failure = { failurePhase: 'compose_exit', failureCategory: 'docker_command', failureReason: 'unknown' };
    life.startFailed(failure);
    life.startFailed(failure);
    life.fail('docker_command', false);
    life.capture('started', {});
    assert.deepEqual(events.map(e => e.name), ['completed', 'start_failed']);
    await life.telemetry.shutdown();
    assert.equal(shutdowns, 1);
    for (const terminal of [undefined, 'completed', 'cancelled', 'failed']) {
        const suppressed = new Lifecycle({ capture() { assert.fail('Unexpected event'); } });
        suppressed.terminal = terminal;
        suppressed.interrupted = true;
        suppressed.startFailed(failure);
    }
});
