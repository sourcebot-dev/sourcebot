import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('bootstrap admits dependency-compatible versions and rejects unsupported gaps before import', () => {
    const root = mkdtempSync(join(tmpdir(), 'setup-bootstrap-'));
    const bin = join(root, 'bin.cjs');
    // Deliberately omit dist: entering the supported branch must stop at its
    // handled missing-module error, never run the wizard or send telemetry.
    copyFileSync(new URL('../../bin.cjs', import.meta.url), bin);
    try {
        for (const [version, supported] of [
            ['18.20.8', false], ['20.19.9', false], ['20.20.0', true], ['20.21.0', true],
            ['21.7.3', false], ['22.21.9', false], ['22.22.0', true],
            ['23.4.9', false], ['23.5.0', true], ['24.0.0', true], ['26.0.0', true],
        ]) {
            const result = spawnSync(process.execPath, ['-e', `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} }); require(${JSON.stringify(bin)});`], { cwd: root, encoding: 'utf8', env: { HOME: root, PATH: '' }, timeout: 10000 });
            assert.equal(result.status, 1, version);
            assert.equal(result.stdout, '', version);
            assert.match(result.stderr, supported ? /Unable to start setup-sourcebot/ : /requires Node.js 20\.20\+/, version);
        }
        assert.deepEqual(readdirSync(root), ['bin.cjs']);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
