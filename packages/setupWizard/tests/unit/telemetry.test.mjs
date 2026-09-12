import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { Telemetry, INSTALL_ID_PATTERN, POSTHOG_OPTIONS, systemProperties } from '../../dist/telemetry.js';
import { eventSchemas, validateFields } from '../../dist/telemetryEvents.js';
import { sourceSummary, aggregateSources, aggregateAi, deployment, hostCategory, selectInstallId, emptyDockerSummary, dockerOutcome, discoveredBucket } from '../../dist/telemetrySummary.js';
import { Lifecycle } from '../../dist/lifecycle.js';

test('UUID contract and persisted identity precedence', () => {
    for (let i = 0; i < 100; i++) {
        const id = new Telemetry(() => { throw Error(); }).setupSessionId;
        assert.match(id, INSTALL_ID_PATTERN);
        assert.equal(id.length, 36);
    }
    const old = randomUUID();
    const next = randomUUID();
    for (const value of [old, `"${old}"`, `'${old}'`, `${old} # comment`]) {
        assert.deepEqual(selectInstallId(`SOURCEBOT_INSTALL_ID=${value}`, next), { id: old, action: 'preserved_existing' });
    }
    for (const value of ['', old.toUpperCase(), 'not-an-id', '$(danger)', `${old}\nSOURCEBOT_INSTALL_ID=invalid`]) {
        assert.deepEqual(selectInstallId(`SOURCEBOT_INSTALL_ID=${value}`, next), { id: next, action: 'created_from_setup_session' });
    }
});

test('code host normalization matches boundaries and formatting, not arbitrary suffixes', () => {
    for (const input of ['github.com', ' HTTPS://WWW.GITHUB.COM./path ', 'http://github.com:8080']) {
        assert.equal(deployment('github', input), 'cloud');
    }
    assert.equal(deployment('github', 'tenant.ghe.com'), 'cloud');
    assert.equal(deployment('github', 'github.com.attacker.invalid'), 'self_hosted');
    assert.equal(deployment('gitlab', 'gitlab.com'), 'cloud');
    assert.equal(deployment('gitlab', 'tenant.gitlab-dedicated.com'), 'cloud');
    assert.equal(deployment('gitlab', 'internal.example'), 'unknown');
    assert.equal(deployment('gitea', 'www.gitea.com'), 'cloud');
    assert.equal(deployment('gitea', 'internal.example'), 'self_hosted');
    for (const input of ['', '://', 'ssh://github.com']) {
        assert.equal(deployment('github', input), 'unknown');
    }
});

test('host classification never performs DNS or exposes an address', () => {
    for (const input of ['http://localhost', 'https://LOCALHOST.:3000', 'http://x.localhost', 'http://127.0.0.0', 'http://127.9.8.7', 'http://[::1]']) {
        assert.equal(hostCategory(input), 'localhost');
    }
    for (const input of ['http://192.168.0.1', 'https://secret.example', 'http://localhost.attacker.invalid', 'http://[::2]']) {
        assert.equal(hostCategory(input), 'address');
    }
    assert.equal(hostCategory('not a URL'), 'unknown');
});

test('aggregates reflect selections, counts, unique providers, and local wildcard collapse', () => {
    const aggregate = aggregateSources([
        sourceSummary('github', { deploymentType: 'cloud', repositoryCount: 2, credentialMode: 'personal_access_token' }),
        sourceSummary('github', { deploymentType: 'self_hosted', organizationCount: 1, indexAll: true }),
        sourceSummary('local_git', { deploymentType: 'local', repositoryCount: 9, generatedConnectionCount: 3 }),
    ]);
    assert.equal(aggregate.repositoryCount, 11);
    assert.equal(aggregate.generatedConnectionCount, 5);
    assert.equal(aggregate.codeSourceConfigurationCount, 3);
    assert.deepEqual(aggregate.codeHostTypes, ['github', 'local_git']);
    assert.equal(aggregate.credentialedCodeSourceCount, 1);
    assert.equal(aggregate.indexAllCodeSourceCount, 1);
    assert.deepEqual([1, 2, 5, 6, 20, 21, 100, 101].map(discoveredBucket), ['1', '2-5', '2-5', '6-20', '6-20', '21-100', '21-100', '101+']);
    assert.deepEqual(aggregateAi([]), { aiConfigured: false, aiConfigurationCount: 0, uniqueProviderCount: 0, providerTypes: [], usesCustomEndpoint: false, credentialModes: [], modelSelectionMethods: [] });
    const model = { provider: 'openai', credentialMode: 'api_key', modelSelectionMethod: 'catalog', usesCustomEndpoint: false, hasDisplayName: true };
    assert.equal(aggregateAi([model, model]).uniqueProviderCount, 1);
    assert.equal(aggregateAi([model, model]).aiConfigurationCount, 2);
});

test('Docker skipped/failed measurements are null and outcome precedence is explicit', () => {
    const state = emptyDockerSummary();
    for (const key of Object.keys(state).filter(k => k.endsWith('Count'))) {
        assert.equal(state[key], null);
    }
    assert.equal(dockerOutcome(state, false, false), 'skipped_no_compose');
    assert.equal(dockerOutcome(state, true, true), 'validation_failed');
    state.leftExistingDeploymentRunning = true;
    assert.equal(dockerOutcome(state, true, false), 'skipped_existing_deployment_running');
    assert.equal(dockerOutcome(state, true, true), 'validation_failed');
    state.leftExistingDeploymentRunning = false;
    state.remainingPortConflictCount = 2;
    assert.equal(dockerOutcome(state, true, false), 'unresolved_conflicts');
    state.remainingPortConflictCount = 0;
    state.volumeAction = 'removed';
    assert.equal(dockerOutcome(state, true, false), 'passed_after_cleanup');
});

test('allowlists reject wrong types and strip arbitrary user values', () => {
    const fields = { configurationIndex: 1, ...sourceSummary('github'), token: 'CANARY_SECRET', repository: 'CANARY_REPO' };
    const output = validateFields(eventSchemas.configured_code_source, fields);
    assert.equal(JSON.stringify(output).includes('CANARY'), false);
    for (const change of [{ configurationIndex: NaN }, { repositoryCount: -1 }, { codeHost: 'CANARY_HOST' }, { scopeTypes: ['CANARY_SCOPE'] }, { indexAll: 'true' }]) {
        assert.throws(() => validateFields(eventSchemas.configured_code_source, { ...fields, ...change }));
    }
});

test('telemetry is fail-open, uses exact identity, default SDK transport and no opt-out coupling', async () => {
    const sent = [];
    const client = { capture: e => sent.push(e), on() {}, async shutdown() {} };
    const previous = process.env.SOURCEBOT_TELEMETRY_DISABLED;
    process.env.SOURCEBOT_TELEMETRY_DISABLED = 'true';
    try {
        const telemetry = new Telemetry(() => client);
        telemetry.capture('started', { invocationMethod: 'unknown', isInteractive: true });
        assert.equal(sent.length, 1);
        const event = sent[0];
        assert.equal(event.distinctId, telemetry.setupSessionId);
        assert.equal(event.properties.install_id, event.distinctId);
        assert.deepEqual(event.groups, { company: event.distinctId });
        assert.equal(event.properties.$geoip_disable, true);
        assert.equal(event.properties.$process_person_profile, undefined);
        assert.ok(event.properties.elapsedMs >= 0);
        await telemetry.shutdown();
        telemetry.capture('started', { invocationMethod: 'unknown', isInteractive: true });
        assert.equal(sent.length, 1);
        for (const broken of [() => { throw Error(); }, () => ({ ...client, capture() { throw Error(); }, shutdown() { throw Error(); } })]) {
            const t = new Telemetry(broken);
            assert.doesNotThrow(() => t.capture('started', { invocationMethod: 'unknown', isInteractive: true }));
            await t.shutdown();
        }
        assert.deepEqual(POSTHOG_OPTIONS, { host: 'https://us.i.posthog.com', flushAt: 1, flushInterval: 0, disableGeoip: true, isServer: false });
        assert.ok(['npm', 'yarn', 'pnpm', 'bun', 'unknown'].includes(systemProperties().packageManager));
    } finally {
        if (previous === undefined) {
            delete process.env.SOURCEBOT_TELEMETRY_DISABLED;
        } else {
            process.env.SOURCEBOT_TELEMETRY_DISABLED = previous;
        }
    }
});

test('terminal latch is independent of multiple recoverable failures', async () => {
    const events = [];
    const t = { capture: (name, props) => events.push({ name, props }), shutdown: async () => {} };
    const life = new Lifecycle(t);
    life.fail('docker_command', true);
    life.fail('docker_unavailable', true);
    await life.complete({});
    await life.decline('keyboard_interrupt');
    life.fail('unknown', false);
    assert.deepEqual(events.map(e => e.name), ['failed', 'failed', 'completed']);
    assert.equal(life.terminal, 'completed');
    const fatal = new Lifecycle(t);
    fatal.fail('filesystem', false);
    await fatal.complete({});
    assert.equal(events.at(-1).name, 'failed');
    assert.equal(events.at(-1).props.recoverable, false);
});

test('each system property falls back independently and elapsed time is monotonic', () => {
    const runtime = { platform: 'linux', arch: 'arm64', versions: { node: '24.1.0' }, env: { npm_config_user_agent: 'pnpm/10.0', CI: 'true' } };
    assert.deepEqual(systemProperties(runtime), { platform: 'linux', arch: 'arm64', nodeMajorVersion: 24, packageManager: 'pnpm', isCI: true });
    for (const [key, field, fallback] of [['platform', 'platform', 'other'], ['arch', 'arch', 'other'], ['versions', 'nodeMajorVersion', null], ['env', 'packageManager', 'unknown']]) {
        const broken = { ...runtime };
        Object.defineProperty(broken, key, { get() { throw Error('fixture'); } });
        assert.equal(systemProperties(broken)[field], fallback);
    }
    const brokenEnv = { ...runtime, get env() { throw Error(); } };
    assert.equal(systemProperties(brokenEnv).isCI, null);
    assert.equal(systemProperties({ ...runtime, versions: { node: 'invalid' } }).nodeMajorVersion, null);
    let now = 100;
    const t = new Telemetry(() => { throw Error(); }, randomUUID, () => now);
    now = 123.6;
    assert.equal(t.elapsed(), 24);
});
