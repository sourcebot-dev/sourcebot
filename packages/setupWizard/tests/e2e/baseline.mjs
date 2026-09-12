import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artifact, scenario, minimal, defaultCompose } from './harness.mjs';
const require = createRequire(import.meta.url);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const packed = artifact();
const base = process.env.SETUP_TEST_BASE_REF ?? '31734dc2';
try {
    const checkout = join(packed.root, 'baseline');
    mkdirSync(checkout);
    const archive = execFileSync('git', ['archive', base, 'packages/setupWizard'], { cwd: repo });
    execFileSync('tar', ['-x', '-C', checkout], { input: archive });
    const pkg = join(checkout, 'packages/setupWizard');
    symlinkSync(join(repo, 'node_modules'), join(checkout, 'node_modules'), 'junction');
    symlinkSync(join(repo, 'packages/setupWizard/node_modules'), join(pkg, 'node_modules'), 'junction');
    execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', pkg], { stdio: 'inherit' });
    const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'));
    // Yarn pack rewrites this dev-only workspace reference; mirror that transformation.
    manifest.devDependencies['@sourcebot/schemas'] = JSON.parse(readFileSync(join(repo, 'packages/schemas/package.json'), 'utf8')).version;
    writeFileSync(join(pkg, 'package.json'), JSON.stringify(manifest));
    const env = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`, PACKAGE_TRACKER_ANALYTICS: 'false' };
    const tgz = execFileSync('npm', ['pack', '--ignore-scripts', '--silent'], { cwd: pkg, env, encoding: 'utf8' }).trim();
    const install = join(packed.root, 'baseline-installed');
    mkdirSync(install);
    writeFileSync(join(install, 'package.json'), '{"private":true,"allowScripts":{"reo-census":true}}');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', join(pkg, tgz)], { cwd: install, env });
    const prior = { ...packed, bin: join(install, 'node_modules/.bin/setup-sourcebot'), installed: join(install, 'node_modules/setup-sourcebot') };
    const normalize = files => Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, name === '.env'
        ? contents.replace(/^SOURCEBOT_INSTALL_ID=.*\n/gm, '').replace(/^# Deployment identifier\n/gm, '').replace(/^(AUTH_SECRET|SOURCEBOT_ENCRYPTION_KEY)=.*$/gm, '$1=<generated>').replace(/\n{3,}/g, '\n\n').trim()
        : contents]));
    for (const download of [false, true]) {
        const run = (target, baseline) => scenario(target, { baseline }, async d => {
            await minimal(d);
            await d.answer('Download docker-compose.yml?', download ? 'y' : 'n');
            if (download) {
                await d.answer('Start Sourcebot now?', 'n');
            }
        });
        const original = await run(prior, true);
        const feature = await run(packed, false);
        assert.deepEqual(original.events, []);
        assert.deepEqual(normalize(feature.files), normalize(original.files));
        assert.deepEqual(feature.dockerCalls, original.dockerCalls);
        assert.equal(feature.exitCode, original.exitCode);
    }
    console.log(`Baseline ${base}: generated config/env and Docker operations match (manual and downloaded Compose); only UUID persistence and generated secrets normalized.`);
} finally {
    packed.cleanup();
}
