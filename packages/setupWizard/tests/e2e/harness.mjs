import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:https';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, delimiter, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
import pty from 'node-pty';
import { eventSchemas, validateFields } from '../../dist/telemetryEvents.js';
import { INSTALL_ID_PATTERN } from '../../dist/telemetry.js';

const require = createRequire(import.meta.url);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const commandEnv = { ...process.env, PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`, PACKAGE_TRACKER_ANALYTICS: 'false' };
export const down = '\x1b[B';
export const canary = 'canary-sensitive';
export const defaultCompose = 'services:\n  sourcebot:\n    image: sourcebot-test\nvolumes:\n  cache:\n';
const commonKeys = ['platform', 'arch', 'nodeMajorVersion', 'packageManager', 'isCI', 'schemaVersion', 'source', 'setupSourcebotVersion', 'setupSessionId', 'install_id', 'elapsedMs', '$geoip_disable', '$ignore_sent_at', '$groups', '$lib', '$lib_version'];
const approvedSchema = JSON.parse(readFileSync(new URL('../approvedSchema.json', import.meta.url), 'utf8'));

export function contract(events, requireTerminal = true) {
    assert.ok(events.length > 0);
    const id = events[0].distinct_id;
    assert.match(id, INSTALL_ID_PATTERN);
    let elapsed = -1;
    let timestamp = -Infinity;
    for (const event of events) {
        const name = event.event.replace(/^setup_sourcebot_/, '');
        assert.ok(approvedSchema[name], `Unexpected event ${name}`);
        assert.deepEqual(Object.keys(event).sort(), ['distinct_id', 'event', 'properties', 'timestamp', 'uuid'].sort());
        assert.deepEqual(Object.keys(event.properties).sort(), [...commonKeys, ...Object.keys(approvedSchema[name])].sort());
        validateFields(eventSchemas[name], event.properties);
        assert.equal(event.distinct_id, id);
        assert.equal(event.properties.setupSessionId, id);
        assert.equal(event.properties.install_id, id);
        assert.deepEqual(event.properties.$groups, { company: id });
        assert.equal(event.properties.$lib, 'posthog-node');
        assert.equal(event.properties.$lib_version, '5.52.1');
        assert.equal(event.properties.$geoip_disable, true);
        assert.equal(event.properties.$ignore_sent_at, true);
        assert.equal(event.properties.nodeMajorVersion, 24);
        assert.equal(event.properties.source, 'setup-sourcebot-cli');
        assert.equal(event.properties.schemaVersion, 1);
        assert.ok(event.properties.elapsedMs >= elapsed);
        elapsed = event.properties.elapsedMs;
        assert.ok(Number.isFinite(Date.parse(event.timestamp)));
        assert.ok(Date.parse(event.timestamp) > timestamp, 'Event timestamps must preserve funnel order');
        timestamp = Date.parse(event.timestamp);
        assert.match(event.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
    assert.equal(JSON.stringify(events).includes(canary), false, 'Sensitive canary reached telemetry');
    const terminal = events.filter(e => ['setup_sourcebot_completed', 'setup_sourcebot_cancelled'].includes(e.event) || (e.event === 'setup_sourcebot_failed' && !e.properties.recoverable));
    if (requireTerminal) {
        assert.equal(terminal.length, 1);
    }
    return id;
}

export function artifact() {
    assert.equal(Number(process.versions.node.split('.')[0]), 24, 'Run packed-artifact tests using Node 24');
    // node-pty 1.1.0 ships its macOS helper without its executable bit in the npm tarball.
    if (process.platform === 'darwin') {
        const helper = join(dirname(require.resolve('node-pty/package.json')), 'prebuilds', `darwin-${process.arch}`, 'spawn-helper');
        if (existsSync(helper)) {
            chmodSync(helper, 0o755);
        }
    }
    const root = mkdtempSync(join(tmpdir(), 'sourcebot-e2e-'));
    // Windows cannot exec .cmd shims directly. Invoke the bundled JS entry points
    // without a shell so temporary paths containing spaces remain literal.
    const packageCommand = (name, args, options) => {
        if (process.platform !== 'win32') {
            return execFileSync(name, args, options);
        }
        const script = join(dirname(process.execPath), 'node_modules', name === 'npm' ? 'npm/bin/npm-cli.js' : 'corepack/dist/yarn.js');
        assert.ok(existsSync(script), `Missing package-manager entry point: ${script}`);
        return execFileSync(process.execPath, [script, ...args], options);
    };
    try {
        const tarball = process.env.SETUP_TEST_TARBALL || join(root, 'setup-sourcebot.tgz');
        if (!process.env.SETUP_TEST_TARBALL) {
            packageCommand('yarn', ['workspace', '@sourcebot/schemas', 'build'], { cwd: packageRoot, env: commandEnv });
            packageCommand('yarn', ['build'], { cwd: packageRoot, env: commandEnv });
            packageCommand('yarn', ['pack', '--out', tarball], { cwd: packageRoot, env: commandEnv });
        }
        const digest = createHash('sha256').update(readFileSync(tarball)).digest('hex');
        const installation = join(root, 'packed install with spaces');
        mkdirSync(installation);
        writeFileSync(join(installation, 'package.json'), '{"name":"isolated-setup-test","private":true,"allowScripts":{"reo-census":true}}');
        packageCommand('npm', ['install', '--no-audit', '--no-fund', '--cache', join(root, 'npm-cache'), tarball], { cwd: installation, env: commandEnv, timeout: 120000 });
        const installed = join(installation, 'node_modules/setup-sourcebot');
        assert.deepEqual(readdirSync(installed).sort(), ['README.md', 'bin.cjs', 'dist', 'package.json'].sort());
        const cert = join(root, 'cert.pem');
        const key = join(root, 'key.pem');
        const openssl = process.platform === 'win32'
            ? [join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe'), join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Git', 'mingw64', 'bin', 'openssl.exe')].find(existsSync) ?? 'openssl'
            : 'openssl';
        execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', key, '-out', cert, '-subj', '/CN=setup-fixture', '-addext', 'subjectAltName=DNS:us.i.posthog.com,DNS:raw.githubusercontent.com,DNS:models.dev,DNS:api.github.com,DNS:gitlab.com,DNS:*.example.invalid'], { stdio: 'ignore' });
        return { root, installed, cert, key, digest, tarball, bin: join(installation, 'node_modules/.bin/setup-sourcebot'), cleanup() { rmSync(root, { recursive: true, force: true }); assert.equal(existsSync(root), false); } };
    } catch (error) {
        rmSync(root, { recursive: true, force: true });
        throw error;
    }
}

export async function scenario(artifact, options, drive) {
    const root = mkdtempSync(join(artifact.root, 'scenario-'));
    const events = [];
    const requests = [];
    const forwarding = [];
    const cwd = join(root, 'work');
    const setup = join(cwd, options.setupName ?? 'sourcebot');
    const fakeBin = join(root, 'bin');
    const home = join(root, 'home');
    for (const dir of [cwd, fakeBin, home]) {
        mkdirSync(dir);
    }
    if (options.files) {
        mkdirSync(setup);
        for (const [name, data] of Object.entries(options.files)) {
            writeFileSync(join(setup, name), data);
        }
    }
    options.prepare?.({ cwd, setup, root });
    writeFileSync(join(root, 'docker-state.json'), JSON.stringify(options.docker ?? {}));
    if (options.realDocker) {
        writeFileSync(join(fakeBin, 'docker'), `#!${process.execPath}\n` +
            `const {spawn}=require('node:child_process'); const args=process.argv.slice(2);\n` +
            `if(!['compose','volume','ps','info'].includes(args[0])){throw Error('Live test Docker command not permitted');}\n` +
            `if(args[0]==='volume' && args[1]!=='ls'){throw Error('Live test volume mutation not permitted');}\n` +
            `const p=spawn(${JSON.stringify(options.realDocker)},args,{stdio:'inherit'});\n` +
            `process.on('SIGINT',()=>{});p.on('error',()=>process.exit(1));p.on('close',c=>process.exit(c??130));\n`, { mode: 0o755 });
    } else if (!options.dockerMissing) {
        if (process.platform === 'win32') {
            // A real executable is needed: Windows spawn(shell:false) cannot
            // execute Unix shebangs or .cmd wrappers. The external preload
            // dispatches this dedicated Node copy to the Docker fixture.
            copyFileSync(process.execPath, join(fakeBin, 'docker.exe'));
        } else {
            writeFileSync(join(fakeBin, 'docker'), `#!${process.execPath}\n` + readFileSync(new URL('./fakeDocker.cjs', import.meta.url), 'utf8'), { mode: 0o755 });
        }
    }
    const server = createServer({ key: readFileSync(artifact.key), cert: readFileSync(artifact.cert) }, async (req, res) => {
        if (req.headers.host === 'us.i.posthog.com') {
            const parts = [];
            for await (const chunk of req) {
                parts.push(chunk);
            }
            const bytes = Buffer.concat(parts);
            const body = JSON.parse((req.headers['content-encoding'] === 'gzip' ? gunzipSync(bytes) : bytes).toString());
            requests.push(body);
            if (options.live) {
                // Only a separately invoked dev smoke enables network forwarding.
                contract(body.batch, false);
                assert.equal(body.api_key, 'phc_lLPuFFi5LH6c94eFJcqvYVFwiJffVcV6HD8U4a1OnRW');
                assert.ok(process.env.SETUP_TEST_DEV_TOKEN, 'Dev project token required');
                const forwarded = { ...body, api_key: process.env.SETUP_TEST_DEV_TOKEN };
                assert.deepEqual({ ...forwarded, api_key: body.api_key }, body);
                assert.equal(req.url, '/batch/', 'Unexpected PostHog ingestion path');
                const request = fetch('https://us.i.posthog.com/batch/', {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(forwarded), signal: AbortSignal.timeout(15000),
                }).then(async response => {
                    assert.ok(response.ok, `Dev ingestion rejected: ${response.status}`);
                    await response.text();
                });
                forwarding.push(request);
                request.catch(() => {});
            }
            if (options.telemetry === 'stall') {
                return;
            }
            if (options.telemetry === 'reset') {
                req.socket.destroy();
                return;
            }
            if (options.telemetry === 'reject') {
                res.writeHead(503).end('{}');
                return;
            }
            events.push(...body.batch);
            res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":1}');
        } else if (req.headers.host === 'raw.githubusercontent.com') {
            if (options.composeStatus === 'stall') {
                return;
            }
            res.writeHead(options.composeStatus ?? 200).end(options.compose ?? defaultCompose);
        } else if (req.headers.host === 'models.dev') {
            if (options.catalog === 'stall') {
                return;
            }
            res.writeHead(options.catalogStatus ?? 200).end(JSON.stringify(options.catalog ?? {}));
        } else if (req.headers.host === 'api.github.com') {
            if (options.searchStatus === 'stall') {
                return;
            }
            if (options.searchStatus === 'reset') {
                req.socket.destroy();
                return;
            }
            res.writeHead(options.searchStatus ?? 200).end(JSON.stringify(options.search ?? { items: [] }));
        } else if (req.headers.host === 'gitlab.com' || req.headers.host?.endsWith('.example.invalid')) {
            res.writeHead(options.searchStatus ?? 200).end(JSON.stringify(options.search ?? []));
        } else {
            res.writeHead(403).end('Unexpected test egress denied');
        }
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    let child;
    let transcript = '';
    let ended;
    let cursor = 0;
    const env = {
        PATH: `${fakeBin}${delimiter}${dirname(process.execPath)}`,
        HOME: home, USERPROFILE: home, TMPDIR: root, TEMP: root, TMP: root,
        XDG_STATE_HOME: join(home, 'state'), XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache'),
        SYSTEMROOT: process.env.SYSTEMROOT ?? '', LANG: 'en_US.UTF-8', TERM: 'xterm-256color',
        NODE_OPTIONS: `--import=${new URL(options.networkModule ?? './network.mjs', import.meta.url).href}`,
        NODE_EXTRA_CA_CERTS: artifact.cert, TEST_CAPTURE_PORT: String(server.address().port),
        TEST_DOCKER_STATE: join(root, 'docker-state.json'), TEST_DOCKER_LOG: join(root, 'docker.log'),
        TEST_DOCKER_PIDS: join(root, 'docker-pids'),
        PACKAGE_TRACKER_ANALYTICS: 'false', SOURCEBOT_TELEMETRY_DISABLED: 'true',
        ...options.environment,
    };
    try {
        child = options.launcher
            ? pty.spawn(options.launcher.file, options.launcher.args, { name: 'xterm-256color', cols: 180, rows: 60, cwd, env })
            : process.platform === 'win32'
            ? pty.spawn(process.execPath, [join(artifact.installed, 'bin.cjs')], { name: 'xterm-256color', cols: 180, rows: 60, cwd, env })
            : pty.spawn(artifact.bin, [], { name: 'xterm-256color', cols: 180, rows: 60, cwd, env });
        child.onData(data => { transcript += stripVTControlCharacters(data); });
        child.onExit(result => { ended = result; });
        const wait = async text => {
            const started = Date.now();
            while (!transcript.slice(cursor).includes(text)) {
                assert.equal(ended, undefined, `CLI exited before ${text}: ${transcript.slice(-1500)}`);
                assert.ok(Date.now() - started < 12000, `Prompt timeout ${text}: ${transcript.slice(-1500)}`);
                await sleep(10);
            }
            cursor = transcript.indexOf(text, cursor) + text.length;
            await sleep(25);
        };
        const answer = async (text, value = '') => { await wait(text); child.write(value + '\r'); };
        const select = async (text, index = 0) => {
            await wait(text);
            for (let n = 0; n < index; n++) {
                child.write(down);
                await sleep(15);
            }
            child.write('\r');
        };
        const multi = async (text, value = `${canary}/repository`) => {
            await wait(text);
            // select-pro initializes its asynchronous option loader after a debounce.
            await sleep(300);
            child.write(value);
            await sleep(550);
            child.write('\t');
            await sleep(50);
            child.write('\r');
        };
        const check = async (text, indexes = [0]) => {
            await wait(text);
            let position = 0;
            for (const index of indexes) {
                while (position < index) {
                    child.write(down);
                    position++;
                    await sleep(15);
                }
                child.write('\t');
                await sleep(20);
            }
            child.write('\r');
        };
        const finish = async (code = 0) => {
            const start = Date.now();
            while (!ended) {
                assert.ok(Date.now() - start < 7000, `CLI did not exit: ${transcript.slice(-1000)}`);
                await sleep(20);
            }
            assert.equal(ended.exitCode, code, transcript.slice(-1000));
        };
        await drive({ answer, select, multi, check, wait, write: data => child.write(data), interrupt: () => process.kill(child.pid, 'SIGINT'), finish, events, setup, root, cwd, home, get transcript() { return transcript; } });
        if (!ended) {
            await finish();
        }
        await Promise.all(forwarding);
        if (!options.telemetry && !options.baseline) {
            contract(events);
        }
        assert.equal(JSON.stringify(requests).includes(canary), false);
        for (const sensitive of options.sensitiveValues ?? []) {
            assert.equal(JSON.stringify(requests).includes(sensitive), false, 'Live credential reached telemetry');
        }
        if (options.assertLauncherHome) {
            options.assertLauncherHome(readdirSync(home, { recursive: true }));
        } else {
            assert.deepEqual(readdirSync(home), [], 'Wizard wrote unexpected per-user state');
        }
        const files = existsSync(setup) ? Object.fromEntries(readdirSync(setup).filter(f => !options.ignoreFiles?.includes(f)).map(f => [f, readFileSync(join(setup, f), 'utf8')])) : {};
        const dockerCalls = existsSync(join(root, 'docker.log')) ? readFileSync(join(root, 'docker.log'), 'utf8').trim().split('\n').map(JSON.parse) : [];
        if (existsSync(join(root, 'docker-pids'))) {
            for (const pid of readFileSync(join(root, 'docker-pids'), 'utf8').trim().split('\n').map(Number)) {
                assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, 'Owned Docker fixture process survived CLI exit');
            }
        }
        const result = { events, files, dockerCalls, requests, exitCode: ended.exitCode };
        await options.verifyDeployment?.({ ...result, setup, root });
        return result;
    } finally {
        if (child && process.platform === 'win32') {
            // node-pty's ConPTY worker survives a natural child exit unless
            // the terminal is disposed; Windows kill() accepts no signal.
            child.kill();
        } else if (child && !ended) {
            child.kill('SIGKILL');
        }
        try {
            await options.cleanupDeployment?.({ setup, root });
        } finally {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
            rmSync(root, { recursive: true, force: true });
            assert.equal(existsSync(root), false);
        }
    }
}

export async function minimal(driver, { existing = false, ai = false, pauseBeforeHosted = false } = {}) {
    await driver.answer('What directory would you like');
    if (existing) {
        await driver.answer('Do you want to overwrite it?', 'y');
    }
    await driver.select('Which code host', 3);
    await driver.answer('Git clone URL', `https://${canary}.example.invalid/repository`);
    await driver.answer('Add another code host?', 'n');
    await driver.answer('Would you like to configure AI features?', ai ? 'y' : 'n');
    if (!ai && !pauseBeforeHosted) {
        await driver.answer('What URL will Sourcebot be hosted at?');
    }
}
