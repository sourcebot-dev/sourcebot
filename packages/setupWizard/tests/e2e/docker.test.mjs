import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { artifact, scenario, minimal, defaultCompose } from './harness.mjs';

let packed;
before(() => { packed = artifact(); console.log(`Docker artifact SHA-256: ${packed.digest}`); });
after(() => packed?.cleanup());
const p = (r, name) => r.events.find(e => e.event === `setup_sourcebot_${name}`)?.properties;
const running = { Name: 'canary-sensitive-running', Service: 'sourcebot', State: 'running' };
const stopped = { Name: 'canary-sensitive-stopped', Service: 'sourcebot', State: 'exited' };
const initial = async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'y'); };

for (const action of ['stop', 'keep', 'fail']) {
    test(`running deployment: ${action}`, async () => {
        const result = await scenario(packed, { docker: { containers: [running], fail: action === 'fail' ? ['compose down'] : [] } }, async d => {
            await initial(d);
            await d.answer('Stop and remove the running deployment?', action === 'keep' ? 'n' : 'y');
            if (action === 'stop') {
                await d.answer('Start Sourcebot now?', 'n');
            }
        });
        assert.equal(p(result, 'validated_docker_state').existingDeploymentAction, { stop: 'stopped', keep: 'left_running', fail: 'stop_failed' }[action]);
        assert.equal(p(result, 'validated_docker_state').outcome, { stop: 'passed_after_cleanup', keep: 'skipped_existing_deployment_running', fail: 'validation_failed' }[action]);
        assert.equal(p(result, 'completed').sourcebotStartOffered, action === 'stop');
        if (action !== 'stop') {
            assert.equal(p(result, 'validated_docker_state').existingVolumeCount, null);
            assert.equal(p(result, 'validated_docker_state').remainingPortConflictCount, null);
        }
    });
}

for (const action of ['remove', 'keep', 'fail']) {
    test(`stopped containers and volumes: ${action}`, async () => {
        const result = await scenario(packed, { docker: { containers: [stopped], volumes: ['sourcebot_cache'], fail: action === 'fail' ? ['compose rm', 'volume rm'] : [] } }, async d => {
            await initial(d);
            await d.answer('Remove them now', action === 'keep' ? 'n' : 'y');
            await d.answer('Wipe these volumes?', action === 'keep' ? 'n' : 'y');
            await d.answer('Start Sourcebot now?', 'n');
        });
        const state = p(result, 'validated_docker_state');
        assert.equal(state.stoppedComposeContainerCount, 1);
        assert.equal(state.existingVolumeCount, 1);
        assert.equal(state.stoppedContainerAction, { remove: 'removed', keep: 'kept', fail: 'remove_failed' }[action]);
        assert.equal(state.volumeAction, { remove: 'removed', keep: 'kept', fail: 'remove_failed' }[action]);
        const failures = result.events.filter(e => e.event === 'setup_sourcebot_failed');
        assert.equal(failures.length, action === 'fail' ? 2 : 0);
        assert.ok(failures.every(e => e.properties.recoverable));
        assert.equal(result.events.at(-1).event, 'setup_sourcebot_completed');
    });
}

for (const failure of ['missing', 'inventory', 'malformed', 'volumes']) {
    test(`Docker failed measurement: ${failure}`, async () => {
        const result = await scenario(packed, { dockerMissing: failure === 'missing', docker: { malformed: failure === 'malformed', fail: failure === 'inventory' ? ['compose ps'] : failure === 'volumes' ? ['volume ls'] : [] } }, async d => {
            await initial(d);
            await d.answer('Start Sourcebot now?', 'n');
        });
        const state = p(result, 'validated_docker_state');
        assert.equal(state.outcome, 'validation_failed');
        if (failure !== 'volumes') {
            assert.equal(state.runningComposeContainerCount, null);
            assert.equal(state.composeContainerState, 'unknown');
        } else {
            assert.equal(state.runningComposeContainerCount, 0);
        }
        if (failure === 'volumes' || failure === 'missing') {
            assert.equal(state.existingVolumeCount, null);
        }
        assert.equal(state.dockerStatus, failure === 'missing' ? 'unavailable' : 'available');
    });
}

for (const action of ['keep', 'stop', 'fail', 'remain']) {
    test(`Docker port conflict: ${action}`, async () => {
        const result = await scenario(packed, { compose: 'services:\n  sourcebot:\n    ports:\n      - "43187:3000"\n', docker: { ports: 'canary-sensitive-container\t0.0.0.0:43187->3000/tcp', fail: action === 'fail' ? ['stop canary-sensitive-container'] : [], keepPorts: action === 'remain' } }, async d => {
            await initial(d);
            await d.answer('Stop this container', action === 'keep' ? 'n' : 'y');
            await d.answer(action === 'stop' ? 'Start Sourcebot now?' : 'Start Sourcebot anyway?', 'n');
        });
        const state = p(result, 'validated_docker_state');
        assert.equal(state.initialPortConflictCount, 1);
        assert.equal(state.remainingPortConflictCount, action === 'stop' ? 0 : 1);
        assert.equal(state.portConflictSource, 'docker');
        assert.equal(state.outcome, action === 'fail' ? 'validation_failed' : action === 'stop' ? 'passed_after_cleanup' : 'unresolved_conflicts');
    });
}

test('failed spawn offers manual steps and completes after recoverable failures', async () => {
    const result = await scenario(packed, { dockerMissing: true }, async d => {
        await initial(d);
        await d.answer('Start Sourcebot now?', 'y');
    });
    assert.equal(p(result, 'completed').sourcebotStartOutcome, 'spawn_failed');
    assert.equal(p(result, 'completed').completionMode, 'sourcebot_start_failed');
    assert.equal(result.events.filter(e => e.event === 'setup_sourcebot_start_failed').length, 1);
    assert.deepEqual(
        ['failurePhase', 'failureCategory', 'failureReason'].map(key => p(result, 'start_failed')[key]),
        ['spawn', 'docker_unavailable', 'docker_unavailable'],
    );
    assert.ok(result.events.filter(e => e.event === 'setup_sourcebot_failed').every(e => e.properties.recoverable));
});

for (const [reason, diagnostic] of [
    ['container_name_conflict', 'Error response from daemon: Conflict. The container name "/canary-sensitive-container" is already in use by container "canary-sensitive-id".'],
    ['port_conflict', 'Error response from daemon: driver failed programming external connectivity: Bind for canary-sensitive-address failed: port is already allocated'],
    ['image_pull_failed', 'Error response from daemon: pull access denied for canary-sensitive-image, repository does not exist or may require docker login'],
    ['mount_failed', 'Error response from daemon: invalid mount config for type "bind": bind source path does not exist: canary-sensitive-path'],
    ['compose_configuration', 'validating canary-sensitive-path: services.sourcebot Additional property canary-sensitive is not allowed'],
    ['docker_unavailable', 'Cannot connect to the Docker daemon at canary-sensitive-socket. Is the docker daemon running?'],
    ['unknown', 'canary-sensitive-unrecognized-error'],
    ['unknown', 'canary-sensitive-app | Error response from daemon: pull access denied for canary-sensitive-image'],
]) {
    test(`post-handoff start failure: ${reason} (${diagnostic.slice(0, 24)})`, async () => {
        const result = await scenario(packed, { docker: { start: { stderrChunks: [diagnostic.slice(0, 17), diagnostic.slice(17)], delayMs: 1100 } } }, async d => {
            await initial(d);
            await d.answer('Start Sourcebot now?', 'y');
            await d.wait(diagnostic);
        });
        const failures = result.events.filter(e => e.event === 'setup_sourcebot_start_failed');
        assert.equal(failures.length, 1);
        assert.equal(failures[0].properties.failurePhase, 'compose_exit');
        assert.equal(failures[0].properties.failureReason, reason);
        assert.equal(failures[0].properties.failureCategory, reason === 'docker_unavailable' ? 'docker_unavailable' : 'docker_command');
        const completed = result.events.find(e => e.event === 'setup_sourcebot_completed');
        assert.ok(result.events.indexOf(completed) < result.events.indexOf(failures[0]));
        assert.equal(failures[0].distinct_id, completed.distinct_id);
        assert.equal(result.events.filter(e => e.event === 'setup_sourcebot_completed').length, 1);
        assert.equal(result.events.some(e => e.event === 'setup_sourcebot_cancelled'), false);
        assert.equal(result.exitCode, 0, 'Telemetry must not change existing CLI exit behavior');
    });
}

for (const termination of [{ exitCode: 0 }, { signal: 'SIGINT' }, { signal: 'SIGTERM' }]) {
    test(`normal Compose termination is not a start failure: ${JSON.stringify(termination)}`, { skip: process.platform === 'win32' && !!termination.signal }, async () => {
        const result = await scenario(packed, { docker: { start: { ...termination, stderrChunks: ['Error response from daemon: pull access denied for canary-sensitive-image\n'] } } }, async d => {
            await initial(d);
            await d.answer('Start Sourcebot now?', 'y');
        });
        assert.equal(result.events.some(e => e.event === 'setup_sourcebot_start_failed'), false);
        assert.equal(p(result, 'completed').sourcebotStartOutcome, 'spawned');
    });
}

test('start failure with unavailable PostHog still exits and retains generated files', async () => {
    const began = Date.now();
    const result = await scenario(packed, { telemetry: 'stall', docker: { start: { stderrChunks: ['canary-sensitive-error'] } } }, async d => {
        await initial(d);
        await d.answer('Start Sourcebot now?', 'y');
    });
    assert.equal(result.exitCode, 0);
    assert.ok(Date.now() - began < 7000);
    assert.deepEqual(Object.keys(result.files).sort(), ['.env', 'config.json', 'docker-compose.yml']);
});

for (const stage of ['fetch', 'docker', 'after_failures']) {
    test(`Ctrl+C during ${stage} cancels outstanding work`, async () => {
        const result = await scenario(packed, {
            composeStatus: stage === 'fetch' ? 'stall' : undefined,
            docker: stage === 'docker' ? { stall: ['compose ps'], stubborn: true } : stage === 'after_failures' ? { containers: [stopped], volumes: ['sourcebot_cache'], fail: ['compose rm', 'volume rm'] } : {},
        }, async d => {
            await initial(d);
            if (stage === 'after_failures') {
                await d.answer('Remove them now', 'y');
                await d.answer('Wipe these volumes?', 'y');
                await d.wait('Start Sourcebot now?');
            } else {
                await sleep(300);
            }
            const began = Date.now();
            d.interrupt();
            await d.finish(130);
            assert.ok(Date.now() - began < 3500);
        });
        assert.equal(result.events.at(-1).event, 'setup_sourcebot_cancelled');
        assert.equal(p(result, 'cancelled').stage, { fetch: 'compose_file', docker: 'docker_validation', after_failures: 'start' }[stage]);
        assert.equal(result.events.some(e => e.event === 'setup_sourcebot_completed'), false);
    });
}

test('Ctrl+C cleans stubborn descendants even if their parent exits first', async () => {
    await scenario(packed, { docker: { stall: ['compose ps'], descendant: true } }, async d => {
        await initial(d);
        await sleep(350);
        d.interrupt();
        await d.finish(130);
    });
});

for (const missing of ['info', 'compose version']) {
    test(`availability probe distinguishes unavailable ${missing}`, async () => {
        const result = await scenario(packed, { docker: { fail: ['compose ps', missing === 'info' ? 'info --format' : missing] } }, async d => {
            await initial(d);
            await d.answer('Start Sourcebot now?', 'n');
        });
        assert.equal(p(result, 'validated_docker_state').dockerStatus, 'unavailable');
        assert.equal(p(result, 'failed').failureCategory, 'docker_unavailable');
    });
}
