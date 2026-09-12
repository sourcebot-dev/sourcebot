import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { artifact, scenario, minimal, canary } from './harness.mjs';
let packed;
before(() => { packed = artifact(); });
after(() => packed?.cleanup());

test('platform: published bootstrap and minimal happy path', async () => {
    const result = await scenario(packed, {}, async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'n'); });
    assert.equal(result.events[0].properties.platform, process.platform);
    assert.equal(result.events[0].properties.arch, process.arch);
    assert.equal(result.events.at(-1).event, 'setup_sourcebot_completed');
});
test('platform: real terminal Ctrl+C exits with cancellation', async () => {
    const result = await scenario(packed, {}, async d => {
        await d.wait('What directory would you like');
        d.write('\x03');
        await d.finish(130);
    });
    assert.equal(result.events.at(-1).event, 'setup_sourcebot_cancelled');
});
test('platform: local repository in a path with spaces and Unicode', async () => {
    const result = await scenario(packed, { prepare({ cwd }) { mkdirSync(join(cwd, `${canary} space-é`, '.git'), { recursive: true }); } }, async d => {
        await d.answer('What directory would you like');
        await d.select('Which code host', 2);
        await d.answer('Path to your repos directory', join(d.cwd, `${canary} space-é`));
        await d.answer('Add another code host?', 'n');
        await d.answer('Would you like to configure AI features?', 'n');
        await d.answer('What URL will Sourcebot be hosted at?');
        await d.answer('Download docker-compose.yml?', 'n');
    });
    assert.ok(result.files['docker-compose.override.yml']);
    assert.equal(result.events.find(e => e.event === 'setup_sourcebot_configured_code_source').properties.codeHost, 'local_git');
});

test('platform: foreground Docker spawn, completion and Ctrl+C cleanup', async () => {
    const result = await scenario(packed, { docker: { stall: ['compose up'], stubborn: true } }, async d => {
        await minimal(d);
        await d.answer('Download docker-compose.yml?', 'y');
        await d.answer('Start Sourcebot now?', 'y');
        const started = Date.now();
        while (!d.events.some(event => event.event === 'setup_sourcebot_completed')) {
            assert.ok(Date.now() - started < 3000);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        d.write('\x03');
        await d.finish(130);
    });
    assert.equal(result.events.filter(event => event.event === 'setup_sourcebot_completed').length, 1);
    assert.equal(result.events.some(event => event.event === 'setup_sourcebot_cancelled'), false);
});
