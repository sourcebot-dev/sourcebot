import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { artifact, scenario, minimal, defaultCompose } from './harness.mjs';

let packed;
before(() => { packed = artifact(); console.log(`Packed artifact SHA-256: ${packed.digest}`); });
after(() => packed?.cleanup());
const names = result => result.events.map(e => e.event.replace('setup_sourcebot_', ''));
const props = (result, name) => result.events.find(e => e.event === `setup_sourcebot_${name}`)?.properties;
const funnel = ['started', 'chose_setup_directory', 'configured_code_source', 'configured_code_sources', 'ai_setup_completed', 'configured_hosted_url', 'generated_configs', 'resolved_compose_file', 'validated_docker_state', 'completed'];

test('packed CLI: full manual funnel, exact identity and only Sourcebot files persisted', async () => {
    const result = await scenario(packed, {}, async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'n'); });
    assert.deepEqual(names(result), funnel);
    assert.deepEqual(Object.keys(result.files).sort(), ['.env', 'config.json']);
    assert.equal(JSON.parse(result.files['config.json']).connections.git.type, 'git');
    assert.equal(result.files['.env'].match(/^SOURCEBOT_INSTALL_ID=(.+)$/m)[1], result.events[0].distinct_id);
    assert.equal(props(result, 'validated_docker_state').runningComposeContainerCount, null);
    assert.equal(props(result, 'completed').sourcebotStartOutcome, 'not_offered');
    assert.equal(result.dockerCalls.length, 0);
});

for (const compose of ['download', 'existing', 'declined', 404, 500]) {
    test(`packed compose resolution: ${compose}`, async () => {
        const existing = compose === 'existing';
        const result = await scenario(packed, { files: existing ? { 'docker-compose.yml': defaultCompose } : undefined, composeStatus: typeof compose === 'number' ? compose : undefined }, async d => {
            await minimal(d, { existing });
            if (!existing) {
                await d.answer('Download docker-compose.yml?', compose === 'declined' ? 'n' : 'y');
            }
            if (existing || compose === 'download') {
                await d.answer('Start Sourcebot now?', 'n');
            }
        });
        const expected = existing ? 'already_present' : compose === 'download' ? 'downloaded' : compose === 'declined' ? 'declined' : 'download_failed';
        assert.equal(props(result, 'resolved_compose_file').outcome, expected);
        assert.equal(props(result, 'completed').sourcebotStartOutcome, existing || compose === 'download' ? 'declined' : 'not_offered');
        assert.equal(names(result).filter(n => n === 'failed').length, typeof compose === 'number' ? 1 : 0);
    });
}

for (const identity of ['valid', 'invalid', 'absent']) {
    test(`existing env identity: ${identity}`, async () => {
        const old = randomUUID();
        const result = await scenario(packed, { files: { '.env': identity === 'absent' ? '' : `SOURCEBOT_INSTALL_ID=${identity === 'valid' ? old : 'invalid'}\n`, 'config.json': '{}' } }, async d => {
            await minimal(d, { existing: true });
            await d.answer('config.json already exists. Overwrite?', 'y');
            await d.answer('.env already exists. Overwrite?', 'y');
            await d.answer('Download docker-compose.yml?', 'n');
        });
        const id = result.files['.env'].match(/^SOURCEBOT_INSTALL_ID=(.+)$/m)[1];
        assert.equal(id, identity === 'valid' ? old : result.events[0].distinct_id);
        assert.equal(JSON.stringify(result.events).includes(old), false);
        assert.equal(props(result, 'generated_configs').deploymentIdentityAction, identity === 'valid' ? 'preserved_existing' : 'created_from_setup_session');
    });
}

for (const parentSignal of [false, true]) {
    test(`prompt cancellation ${parentSignal ? 'parent SIGINT' : 'PTY Ctrl+C'}`, async () => {
        const result = await scenario(packed, {}, async d => {
            await d.wait('What directory would you like');
            const began = Date.now();
            if (parentSignal) {
                d.interrupt();
            } else {
                d.write('\x03');
            }
            await d.finish(130);
            assert.ok(Date.now() - began < 3500);
        });
        assert.deepEqual(names(result), ['started', 'cancelled']);
        assert.deepEqual(result.files, {});
    });
}

test('completion is committed at spawn; Ctrl+C still exits without a cancellation event', async () => {
    const result = await scenario(packed, { docker: { stall: ['compose up'], stubborn: true } }, async d => {
        await minimal(d);
        await d.answer('Download docker-compose.yml?', 'y');
        await d.answer('Start Sourcebot now?', 'y');
        const began = Date.now();
        while (!d.events.some(e => e.event === 'setup_sourcebot_completed')) {
            assert.ok(Date.now() - began < 3000);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        d.interrupt();
        await d.finish(130);
    });
    assert.deepEqual(names(result), funnel);
    assert.equal(props(result, 'completed').sourcebotStartOutcome, 'spawned');
});

for (const telemetry of ['reject', 'stall', 'reset']) {
    test(`telemetry ${telemetry} does not change files or successful completion`, async () => {
        const began = Date.now();
        const result = await scenario(packed, { telemetry }, async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'n'); });
        assert.equal(result.exitCode, 0);
        assert.ok(Date.now() - began < 10000);
        assert.deepEqual(Object.keys(result.files).sort(), ['.env', 'config.json']);
    });
}

test('Ctrl+C at start prompt cancels before Docker can spawn', async () => {
    const result = await scenario(packed, {}, async d => {
        await minimal(d);
        await d.answer('Download docker-compose.yml?', 'y');
        await d.wait('Start Sourcebot now?');
        d.interrupt();
        await d.finish(130);
    });
    assert.equal(props(result, 'cancelled').stage, 'start');
    assert.equal(props(result, 'completed'), undefined);
    assert.equal(result.dockerCalls.some(args => args.join(' ') === 'compose up'), false);
});

test('repeated Ctrl+C forces prompt exit despite a stalled SDK shutdown', async () => {
    const result = await scenario(packed, { telemetry: 'stall' }, async d => {
        await d.wait('What directory would you like');
        const began = Date.now();
        d.interrupt();
        await new Promise(resolve => setTimeout(resolve, 50));
        d.interrupt();
        await d.finish(130);
        assert.ok(Date.now() - began < 1500, 'Second interrupt must not restart the shutdown deadline');
    });
    const attempted = result.requests.flatMap(request => request.batch);
    assert.ok(attempted.filter(event => event.event === 'setup_sourcebot_cancelled').length <= 1);
    assert.deepEqual(result.files, {});
});

test('Ctrl+C after completion still cleans stubborn Docker while telemetry stalls', async () => {
    await scenario(packed, { telemetry: 'stall', docker: { stall: ['compose up'], stubborn: true } }, async d => {
        await minimal(d);
        await d.answer('Download docker-compose.yml?', 'y');
        await d.answer('Start Sourcebot now?', 'y');
        await new Promise(resolve => setTimeout(resolve, 100));
        const began = Date.now();
        d.interrupt();
        await d.finish(130);
        assert.ok(Date.now() - began < 3500);
    });
});
