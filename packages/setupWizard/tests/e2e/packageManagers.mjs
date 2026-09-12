import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { artifact, scenario, minimal } from './harness.mjs';

// Install launchers into this test's disposable root, never globally. Their
// executable scripts and the wizard are both run with the required Node 24.
const packed = artifact();
try {
    const managerRoot = join(packed.root, 'managers');
    mkdirSync(managerRoot);
    writeFileSync(join(managerRoot, 'package.json'), JSON.stringify({ private: true, allowScripts: { bun: true, pnpm: true } }));
    execFileSync('npm', ['install', '--no-audit', '--no-fund', '--cache', join(packed.root, 'manager-cache'), 'npm@12.0.2', '@yarnpkg/cli-dist@4.7.0', 'pnpm@12.4.1', 'bun@1.4.2'], {
        cwd: managerRoot, env: { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`, PACKAGE_TRACKER_ANALYTICS: 'false' }, timeout: 120000,
    });
    for (const [name, packageName, prefix] of [
        ['npm', 'npm', ['exec', '--offline', '--']],
        ['yarn', '@yarnpkg/cli-dist', ['exec']],
        ['pnpm', 'pnpm', ['exec']],
        ['bun', 'bun', ['x', '--no-install']],
    ]) {
        const directory = join(managerRoot, 'node_modules', packageName);
        const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
        const binary = join(directory, typeof manifest.bin === 'string' ? manifest.bin : manifest.bin[name]);
        const managerEnv = { npm_config_cache: join(packed.root, 'invocation-cache'), npm_config_script_shell: '/bin/sh', YARN_ENABLE_TELEMETRY: '0', YARN_GLOBAL_FOLDER: join(packed.root, 'yarn-global'), YARN_CACHE_FOLDER: join(packed.root, 'yarn-cache') };
        const result = await scenario(packed, {
            launcher: { file: binary, args: [...prefix, name === 'yarn' ? JSON.stringify(packed.bin) : name === 'bun' ? 'setup-sourcebot' : packed.bin] },
            environment: managerEnv,
            assertLauncherHome(paths) {
                // Package managers may write their own state before launching
                // the wizard. Direct-binary suites still require an empty home.
                const permitted = /^(Library(?:\/(?:Caches\/)?pnpm(?:\/.*)?)?|state(?:\/pnpm(?:\/.*)?)?|cache(?:\/pnpm(?:\/.*)?)?|\.local(?:\/share(?:\/pnpm(?:\/.*)?)?)?)$/;
                const unexpected = paths.filter(path => name !== 'pnpm' || !permitted.test(path));
                assert.deepEqual(unexpected, [], 'Unexpected launcher state outside the known pnpm store/state directories');
            },
            prepare({ cwd }) {
                writeFileSync(join(cwd, 'package.json'), JSON.stringify({ private: true, name: 'isolated-launcher', ...(name === 'yarn' ? { packageManager: 'yarn@4.7.0' } : {}) }));
                writeFileSync(join(cwd, 'yarn.lock'), '');
                writeFileSync(join(cwd, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
                if (name === 'yarn') {
                    execFileSync(process.execPath, [binary, 'install', '--mode=skip-build'], { cwd, env: { ...process.env, ...managerEnv }, timeout: 30000 });
                }
                if (name === 'bun') {
                    symlinkSync(dirname(packed.installed), join(cwd, 'node_modules'), 'junction');
                }
            },
        }, async d => { await minimal(d); await d.answer('Download docker-compose.yml?', 'n'); });
        const started = result.events[0].properties;
        assert.equal(started.packageManager, name);
        assert.ok(['npx', 'workspace', 'local_binary', 'unknown'].includes(started.invocationMethod));
        console.log(`${name}@${manifest.version}: packed binary completed; packageManager=${started.packageManager}; invocationMethod=${started.invocationMethod}`);
    }
    console.log(`Package-manager launcher matrix passed: ${packed.digest}`);
} finally {
    packed.cleanup();
}
