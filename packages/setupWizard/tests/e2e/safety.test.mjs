import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { artifact, scenario, minimal, canary } from './harness.mjs';

let packed;
before(() => { packed = artifact(); console.log(`Safety artifact SHA-256: ${packed.digest}`); });
after(() => packed?.cleanup());
const prop = (r, n) => r.events.find(e => e.event === `setup_sourcebot_${n}`)?.properties;

for (const stage of ['directory', 'config', 'env']) {
    test(`explicit decline: ${stage}`, async () => {
        const files = stage === 'directory' ? {} : stage === 'config' ? { 'config.json': 'original' } : { '.env': 'original' };
        const result = await scenario(packed, { files }, async d => {
            if (stage === 'directory') {
                await d.answer('What directory would you like');
                await d.answer('Do you want to overwrite it?', 'n');
            } else {
                await minimal(d, { existing: true });
                await d.answer(stage === 'config' ? 'config.json already exists. Overwrite?' : '.env already exists. Overwrite?', 'n');
            }
        });
        assert.equal(result.events.at(-1).event, 'setup_sourcebot_cancelled');
        assert.deepEqual(result.files, files);
        assert.equal(prop(result, 'cancelled').reason, stage === 'directory' ? 'existing_directory_declined' : 'config_overwrite_declined');
    });
}

test('fatal directory creation failure: failed without checkpoint or files', async () => {
    const result = await scenario(packed, { prepare({ cwd }) { writeFileSync(join(cwd, 'blocked'), 'fixture'); } }, async d => {
        await d.answer('What directory would you like', 'blocked/child');
        await d.finish(1);
    });
    assert.deepEqual(result.events.map(e => e.event), ['setup_sourcebot_started', 'setup_sourcebot_failed']);
    assert.equal(prop(result, 'failed').failureCategory, 'filesystem');
    assert.equal(prop(result, 'failed').recoverable, false);
});

test('fatal config write failure does not emit generated_configs', async () => {
    const result = await scenario(packed, { files: {}, ignoreFiles: ['config.json'], prepare({ setup }) { mkdirSync(join(setup, 'config.json')); } }, async d => {
        await minimal(d, { existing: true });
        await d.answer('config.json already exists. Overwrite?', 'y');
        await d.finish(1);
    });
    assert.equal(prop(result, 'generated_configs'), undefined);
    assert.equal(prop(result, 'failed').failureCategory, 'filesystem');
    assert.equal(result.events.at(-1).event, 'setup_sourcebot_failed');
});

test('multiple code-source loop emits sequential indexes and exact aggregate', async () => {
    const result = await scenario(packed, {}, async d => {
        await d.answer('What directory would you like');
        for (let i = 0; i < 3; i++) {
            await d.select('Which code host', 3);
            await d.answer('Git clone URL', `https://${canary}.example.invalid/repo-${i}`);
            await d.answer('Add another code host?', i === 2 ? 'n' : 'y');
        }
        await d.answer('Would you like to configure AI features?', 'n');
        await d.answer('What URL will Sourcebot be hosted at?', `https://${canary}.example.invalid/path?secret=yes`);
        await d.answer('Download docker-compose.yml?', 'n');
    });
    assert.deepEqual(result.events.filter(e => e.event === 'setup_sourcebot_configured_code_source').map(e => e.properties.configurationIndex), [1, 2, 3]);
    assert.equal(prop(result, 'configured_code_sources').repositoryCount, 3);
    assert.equal(prop(result, 'configured_code_sources').uniqueCodeHostCount, 1);
    assert.equal(prop(result, 'configured_hosted_url').hostCategory, 'address');
});

for (const status of [401, 403, 500, 'reset', 'malformed']) {
    test(`GitHub autocomplete fallback: ${status}`, async () => {
        const result = await scenario(packed, { searchStatus: status === 'malformed' ? 200 : status, search: status === 'malformed' ? { items: [null] } : undefined }, async d => {
            await d.answer('What directory would you like');
            await d.select('Which code host');
            await d.answer('GitHub URL');
            await d.answer('GitHub Personal Access Token', `${canary}-token`);
            await d.check('What do you want to index?');
            await d.multi('Repositories to index');
            await d.answer('Add another code host?', 'n');
            await d.answer('Would you like to configure AI features?', 'n');
            await d.answer('What URL will Sourcebot be hosted at?');
            await d.answer('Download docker-compose.yml?', 'n');
        });
        assert.equal(prop(result, 'configured_code_source').repositoryCount, 1);
        assert.equal(prop(result, 'failed').failureCategory, 'network');
        assert.equal(prop(result, 'failed').recoverable, true);
        assert.equal(result.events.at(-1).event, 'setup_sourcebot_completed');
    });
}

for (const mode of ['catalog', 'custom', 'malformed', 'http_failure']) {
    test(`model catalog ${mode}, repeated-provider credential reuse`, async () => {
        const catalog = { anthropic: { models: { fixture: { id: `${canary}-model`, name: `${canary}-name` } } } };
        if (mode === 'malformed') {
            catalog.anthropic.models.fixture = null;
        }
        const result = await scenario(packed, { catalog, catalogStatus: mode === 'http_failure' ? 503 : 200 }, async d => {
            await minimal(d, { ai: true });
            for (let i = 0; i < 2; i++) {
                await d.select('Which AI provider?');
                if (mode === 'catalog' || mode === 'custom') {
                    await d.wait('Model name');
                    await sleep(350);
                    if (mode === 'custom') {
                        d.write(`${canary}-custom`);
                        await sleep(350);
                    }
                    d.write('\r');
                } else {
                    await d.answer('Model name', `${canary}-fallback`);
                }
                if (!i) {
                    await d.answer('API key (', `${canary}-key`);
                }
                await d.answer('Display name');
                await d.answer('Add another model?', i ? 'n' : 'y');
            }
            await d.answer('What URL will Sourcebot be hosted at?');
            await d.answer('Download docker-compose.yml?', 'n');
        });
        assert.equal(prop(result, 'ai_setup_completed').aiConfigurationCount, 2);
        assert.equal(prop(result, 'ai_setup_completed').uniqueProviderCount, 1);
        assert.equal(prop(result, 'generated_configs').credentialVariableCount, 1);
        assert.equal(prop(result, 'configured_ai_provider').modelSelectionMethod, mode === 'catalog' ? 'catalog' : mode === 'custom' ? 'custom_entry' : 'manual_fallback');
    });
}

for (const stage of ['code_sources', 'ai_setup', 'hosted_url', 'compose_file']) {
    test(`Ctrl+C at stage ${stage}`, async () => {
        const result = await scenario(packed, {}, async d => {
            if (stage === 'code_sources') {
                await d.answer('What directory would you like');
                await d.wait('Which code host');
            } else if (stage === 'ai_setup') {
                await minimal(d, { ai: true });
                await d.wait('Which AI provider?');
            } else if (stage === 'hosted_url') {
                await minimal(d, { pauseBeforeHosted: true });
                await d.wait('What URL will Sourcebot be hosted at?');
            } else {
                await minimal(d);
                await d.wait('Download docker-compose.yml?');
            }
            d.write('\x03');
            await d.finish(130);
        });
        assert.equal(prop(result, 'cancelled').stage, stage);
    });
}
