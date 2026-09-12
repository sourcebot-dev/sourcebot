import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { artifact } from './harness.mjs';

// Build once on the release runtime, then install and exercise that exact tarball
// on each minimum supported LTS runtime. No production telemetry is sent.
const packed = artifact();
const packageRoot = new URL('../..', import.meta.url);
try {
    for (const version of ['20.20.0', '22.22.0', '18.20.8', '20.19.0', '22.21.0']) {
        const runtimeRoot = join(packed.root, `node-${version}`);
        mkdirSync(runtimeRoot);
        execFileSync('npm', ['install', '--prefix', runtimeRoot, '--no-audit', '--no-fund', '--cache', join(packed.root, 'runtime-cache'), `node@${version}`], { stdio: 'pipe', timeout: 120000 });
        const node = join(runtimeRoot, 'node_modules/node/bin/node');
        const env = { ...process.env, PATH: `${dirname(node)}${delimiter}${process.env.PATH}`, PACKAGE_TRACKER_ANALYTICS: 'false', SETUP_TEST_TARBALL: packed.tarball };
        if (['20.20.0', '22.22.0'].includes(version)) {
            const tests = [
                ...['unit', 'integration'].flatMap(dir => readdirSync(new URL(`../${dir}/`, import.meta.url)).filter(f => f.endsWith('.test.mjs')).map(f => `tests/${dir}/${f}`)),
                ...['wizard', 'collectors', 'docker', 'safety', 'platform'].map(f => `tests/e2e/${f}.test.mjs`),
            ];
            execFileSync(node, ['--test', '--test-concurrency=1', ...tests], { cwd: packageRoot, env, stdio: 'inherit', timeout: 600000 });
            console.log(`Node ${version}: packed CLI and telemetry regression suites passed; artifact ${packed.digest}`);
        } else {
            const work = join(runtimeRoot, 'empty-home');
            mkdirSync(work);
            const result = spawnSync(node, [join(packed.installed, 'bin.cjs')], { cwd: work, encoding: 'utf8', env: { PATH: '', HOME: work }, timeout: 10000 });
            assert.equal(result.status, 1);
            assert.match(result.stderr, /requires Node.js 20\.20\+, 22\.22\+, or 23\.5\+/);
            assert.equal(result.stdout, '');
            assert.deepEqual(readdirSync(work), []);
            console.log(`Node ${version}: rejected before importing the wizard`);
        }
    }
} finally {
    packed.cleanup();
}
