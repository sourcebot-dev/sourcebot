import assert from 'node:assert/strict';
import { cpSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { artifact } from './harness.mjs';

const packed = artifact();
const name = `sourcebot-linux-e2e-${randomUUID()}`;
const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
try {
    const snapshot = join(packed.root, 'linux-package');
    mkdirSync(snapshot);
    // Never mount the changing worktree into a running verification job.
    for (const path of ['dist', 'tests', 'package.json']) {
        cpSync(join(packageRoot, path), join(snapshot, path), { recursive: true });
    }
    execFileSync('docker', ['run', '--rm', '--name', name, '-e', 'PACKAGE_TRACKER_ANALYTICS=false', '-e', 'SETUP_TEST_TARBALL=/fixture/setup-sourcebot.tgz',
        '-v', `${snapshot}:/work/packages/setupWizard:ro`, '-v', `${packed.tarball}:/fixture/setup-sourcebot.tgz:ro`, '-w', '/work', 'node:24-bookworm', 'sh', '-c',
        'npm install --no-audit --no-fund posthog-node@5.52.1 node-pty@1.1.0 undici@7.29.1 && node --test --test-concurrency=1 packages/setupWizard/tests/e2e/wizard.test.mjs packages/setupWizard/tests/e2e/collectors.test.mjs packages/setupWizard/tests/e2e/docker.test.mjs packages/setupWizard/tests/e2e/safety.test.mjs && node packages/setupWizard/tests/e2e/packageManagers.mjs'], { stdio: 'inherit', timeout: 600000 });
    console.log(`Linux packed-artifact matrix passed: ${packed.digest}`);
} finally {
    try { execFileSync('docker', ['rm', '-f', name], { stdio: 'ignore' }); } catch { /* --rm already handled completion. */ }
    assert.equal(execFileSync('docker', ['ps', '-aq', '--filter', `name=^/${name}$`], { encoding: 'utf8' }).trim(), '');
    packed.cleanup();
}
