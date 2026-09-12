import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifact, scenario, minimal } from './harness.mjs';
import { INSTALL_ID_PATTERN } from '../../dist/telemetry.js';

test('real Docker name conflict emits a private diagnostic after setup completion', async () => {
    const packed = artifact();
    const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
    const image = process.env.SETUP_TEST_SOURCEBOT_IMAGE ?? 'docker.sourcebot.dev/sourcebot-dev/sourcebot:latest';
    const name = `setup-start-conflict-${randomUUID()}`;
    const project = `setup-start-${randomUUID()}`;
    let created = false;
    try {
        execFileSync(docker, ['create', '--name', name, '--label', `setup-start-test=${project}`, image], { stdio: 'pipe', timeout: 45000 });
        created = true;
        const host = execFileSync(docker, ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
        const result = await scenario(packed, {
            realDocker: docker,
            compose: `services:\n  sourcebot:\n    image: ${image}\n    container_name: ${name}\n    pull_policy: never\n`,
            sensitiveValues: [name, project],
            assertLauncherHome(paths) {
                // Docker Desktop creates these empty parent directories itself.
                // Still reject files or any wizard-owned per-user state.
                const dockerDirectories = process.platform === 'darwin'
                    ? ['Library', 'Library/Containers', 'Library/Containers/com.docker.docker', 'Library/Containers/com.docker.docker/Data']
                    : [];
                assert.deepEqual(paths.filter(path => !dockerDirectories.includes(path)), []);
            },
            environment: { COMPOSE_PROJECT_NAME: project, DOCKER_HOST: host, DOCKER_CONFIG: process.env.DOCKER_CONFIG ?? join(homedir(), '.docker') },
            async cleanupDeployment({ setup }) {
                execFileSync(docker, ['compose', '-p', project, 'down'], { cwd: setup, stdio: 'pipe', timeout: 45000 });
            },
        }, async d => {
            await minimal(d);
            await d.answer('Download docker-compose.yml?', 'y');
            await d.answer('Start Sourcebot now?', 'y');
            await d.wait('is already in use by container');
        });
        const failure = result.events.filter(e => e.event === 'setup_sourcebot_start_failed');
        assert.equal(failure.length, 1);
        assert.equal(failure[0].properties.failureReason, 'container_name_conflict');
        assert.equal(failure[0].properties.failurePhase, 'compose_exit');
        assert.equal(result.events.at(-1).event, 'setup_sourcebot_start_failed');
        assert.ok(result.events.some(e => e.event === 'setup_sourcebot_completed'));
    } finally {
        try {
            if (created) execFileSync(docker, ['rm', '-v', name], { stdio: 'pipe', timeout: 45000 });
        } finally {
            packed.cleanup();
        }
    }
});

test('real Sourcebot containers: packed wizard identity survives first boot, restart, upgrade and opt-out', async () => {
    const packed = artifact();
    const image = process.env.SETUP_TEST_SOURCEBOT_IMAGE ?? 'docker.sourcebot.dev/sourcebot-dev/sourcebot:latest';
    const label = `setup-wizard-e2e-${randomUUID()}`;
    const fixtures = fileURLToPath(new URL('.', import.meta.url));
    const entrypoint = resolve(fixtures, '../../../../entrypoint.sh');
    const containerNames = [];
    const live = process.env.SETUP_TEST_LIVE === 'true';
    if (live) {
        assert.equal(process.env.SETUP_TEST_DEV_TOKEN, 'phc_EJR6BsaBbvIKhM4t4zp1boYC92Tpp5Fgb9Csa9Us5aw', 'Live runtime verification is restricted to the approved dev project');
    }
    try {
        const setup = await scenario(packed, { live }, async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'n'); });
        const setupId = setup.events[0].distinct_id;
        const envFile = join(packed.root, 'deployment.env');
        writeFileSync(envFile, setup.files['.env']);
        const versionFile = join(packed.root, 'version.ts');
        const boot = (data, version, options = {}) => {
            mkdirSync(join(packed.root, data), { recursive: true });
            writeFileSync(versionFile, `export const SOURCEBOT_VERSION = "${version}";\n`);
            const name = `${label}-${containerNames.length}`;
            containerNames.push(name);
            const output = execFileSync('docker', ['run', '--rm', '--name', name, '--label', label, '--network', 'none', '--add-host', 'us.i.posthog.com:127.0.0.1',
                '--env-file', envFile, '-e', `SOURCEBOT_TELEMETRY_DISABLED=${options.disabled ? 'true' : 'false'}`, '-e', 'POSTHOG_PAPIK=phc_runtime_fixture',
                ...(options.id !== undefined ? ['-e', `SOURCEBOT_INSTALL_ID=${options.id}`] : []),
                ...(options.omit ? ['-e', 'TEST_OMIT_INSTALL_ID=true'] : []),
                '-v', `${join(packed.root, data)}:/data`, '-v', `${join(fixtures, 'runtimeFixture.mjs')}:/fixture/runtimeFixture.mjs:ro`,
                '-v', `${entrypoint}:/fixture/entrypoint.sh:ro`, '-v', `${packed.cert}:/fixture/cert.pem:ro`, '-v', `${packed.key}:/fixture/key.pem:ro`,
                '-v', `${versionFile}:/app/packages/shared/src/version.ts:ro`, '--entrypoint', 'node', image, '/fixture/runtimeFixture.mjs'], { timeout: 45000, encoding: 'utf8' });
            return JSON.parse(output.trim());
        };
        const first = boot('supplied', 'v5.1.3');
        assert.equal(first.installId, setupId);
        assert.equal(first.persisted.install_id, setupId);
        assert.deepEqual(first.events.map(e => [e.event, e.distinct_id]), [['install', setupId]]);
        const restart = boot('supplied', 'v5.1.3', { id: randomUUID() });
        assert.equal(restart.installId, setupId);
        assert.deepEqual(restart.events, []);
        const upgrade = boot('supplied', 'v5.1.4', { id: randomUUID() });
        assert.equal(upgrade.installId, setupId);
        assert.deepEqual(upgrade.events.map(e => [e.event, e.distinct_id]), [['upgrade', setupId]]);
        const omittedRestart = boot('supplied', 'v5.1.4', { omit: true });
        assert.equal(omittedRestart.installId, setupId);
        assert.deepEqual(omittedRestart.events, []);
        const generated = boot('generated', 'v5.1.3', { omit: true });
        assert.match(generated.installId, INSTALL_ID_PATTERN);
        assert.notEqual(generated.installId, setupId);
        assert.equal(generated.events[0].distinct_id, generated.installId);
        const generatedRestart = boot('generated', 'v5.1.3', { omit: true });
        assert.equal(generatedRestart.installId, generated.installId);
        const disabled = boot('disabled', 'v5.1.3', { disabled: true });
        assert.equal(disabled.installId, setupId);
        assert.deepEqual(disabled.events, []);
        const disabledRestart = boot('disabled', 'v5.1.4', { disabled: true, id: randomUUID() });
        assert.equal(disabledRestart.installId, setupId);
        assert.deepEqual(disabledRestart.events, []);
        if (live) {
            // Forward only the two already-validated synthetic payloads captured
            // from actual curl. The container itself never has external egress.
            for (const payload of [first.events[0], upgrade.events[0]]) {
                assert.equal(payload.distinct_id, setupId);
                assert.equal(JSON.stringify(payload).includes('canary-sensitive'), false);
                const forwarded = { ...payload, api_key: process.env.SETUP_TEST_DEV_TOKEN };
                assert.deepEqual({ ...forwarded, api_key: payload.api_key }, payload);
                const response = await fetch('https://us.i.posthog.com/capture/', {
                    method: 'POST', headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(forwarded), signal: AbortSignal.timeout(15000),
                });
                assert.ok(response.ok, `Dev runtime ingestion rejected: ${response.status}`);
                await response.text();
            }
            console.log(JSON.stringify({ artifactSha256: packed.digest, distinctId: setupId, eventsForwarded: setup.events.length + 2, ingestion: 'accepted; query verification still required' }));
        }
        console.log(`Identity continuity verified across 8 containers; artifact SHA-256 ${packed.digest}`);
    } finally {
        for (const name of containerNames) {
            try { execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' }); } catch { /* --rm already cleaned completed containers. */ }
        }
        assert.equal(execFileSync('docker', ['ps', '-aq', '--filter', `label=${label}`], { encoding: 'utf8' }).trim(), '');
        packed.cleanup();
    }
});
