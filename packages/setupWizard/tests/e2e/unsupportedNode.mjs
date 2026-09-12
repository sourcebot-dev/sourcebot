import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { artifact } from './harness.mjs';
const packed = artifact();
try {
    const node22 = process.env.SETUP_TEST_NODE22 ?? execFileSync('npm', ['exec', '--yes', '--package=node@22.22.0', '--', 'node', '-p', 'process.execPath'], { encoding: 'utf8' }).trim();
    const work = join(packed.root, 'node22');
    mkdirSync(work);
    const result = spawnSync(node22, [join(packed.installed, 'bin.cjs')], { cwd: work, encoding: 'utf8', env: { PATH: '', HOME: work } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires Node.js 24 or newer/);
    assert.equal(result.stdout, '');
    assert.deepEqual(readdirSync(work), []);
    console.log(`Node 22.22 rejected before loading the wizard; artifact ${packed.digest}`);
} finally {
    packed.cleanup();
}
