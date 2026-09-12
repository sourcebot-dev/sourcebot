import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync, realpathSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifact, scenario } from './harness.mjs';

const packed = artifact();
const docker = execFileSync('which', ['docker'], { encoding: 'utf8' }).trim();
const image = 'docker.sourcebot.dev/sourcebot-dev/sourcebot:v5.1.13';
const reports = [];
const providers = ['anthropic', 'openai', 'openai-compatible', 'amazon-bedrock', 'google-generative-ai', 'google-vertex', 'google-vertex-anthropic', 'azure', 'deepseek', 'mistral', 'openrouter', 'xai'];
const output = process.env.SETUP_TEST_LIVE_OUTPUT;
if (output) {
    mkdirSync(output, { recursive: true });
}
let browser;
let parse, stringify, dotenv;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const liveMulti = async (driver, prompt, value) => {
    await driver.wait(prompt);
    await pause(350);
    driver.write(value);
    await driver.wait(`[ ] ${value}`);
    driver.write('\t');
    await pause(100);
    driver.write('\r');
};
const run = (args, options = {}) => execFileSync(docker, args, { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'pipe'], ...options });
const freePort = async () => {
    const server = createServer().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
};
function credentials() {
    assert.ok(process.env.SETUP_TEST_CREDENTIAL_DIR, 'Set SETUP_TEST_CREDENTIAL_DIR to the development env-file directory');
    for (const file of ['.env.local', '.env.development.local', '.env.local.development']) {
        const path = join(process.env.SETUP_TEST_CREDENTIAL_DIR, file);
        if (existsSync(path)) {
            const values = dotenv(readFileSync(path));
            if (values.ANTHROPIC_API_KEY) {
                return values.ANTHROPIC_API_KEY;
            }
        }
    }
}

try {
    const dockerConfig = join(packed.root, 'docker-client');
    mkdirSync(dockerConfig);
    const pluginDirectory = resolve(dirname(realpathSync(docker)), '../cli-plugins');
    writeFileSync(join(dockerConfig, 'config.json'), JSON.stringify({ cliPluginsExtraDirs: existsSync(pluginDirectory) ? [pluginDirectory] : [] }));
    const dockerHost = run(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).trim();
    const tools = join(packed.root, 'browser-tools');
    mkdirSync(tools);
    writeFileSync(join(tools, 'package.json'), '{"private":true}');
    process.env.PLAYWRIGHT_BROWSERS_PATH = join(packed.root, 'browsers');
    execFileSync('npm', ['install', '--no-audit', '--no-fund', 'playwright@1.63.0', 'yaml@2.8.3', 'dotenv@16.4.7'], { cwd: tools, timeout: 120000, stdio: 'ignore' });
    ({ parse, stringify } = await import(pathToFileURL(join(tools, 'node_modules/yaml/dist/index.js')).href));
    ({ parse: dotenv } = await import(pathToFileURL(join(tools, 'node_modules/dotenv/lib/main.js')).href));
    execFileSync(process.execPath, [join(tools, 'node_modules/playwright/cli.js'), 'install', 'chromium'], { timeout: 180000, stdio: 'ignore' });
    const { chromium } = await import(pathToFileURL(join(tools, 'node_modules/playwright/index.mjs')).href);
    browser = await chromium.launch({ headless: true });
    const upstream = await fetch('https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/docker-compose.yml');
    assert.ok(upstream.ok);
    const composeSource = await upstream.text();
    const cases = (process.env.SETUP_TEST_LIVE_CASES ?? 'github_repo').split(',');
    const knownCases = new Set(['github_repo', 'github_org', 'github_user', 'gitlab_project', 'remote_git', 'local_root', 'local_wildcard', 'local_nested', 'anthropic', 'gitea_repo', 'gerrit_project', 'auto_start', 'ai_all']);
    assert.ok(cases.every(name => knownCases.has(name)), 'Unknown live deployment scenario');
    for (const name of cases) {
        const project = `sb-e2e-${randomUUID().slice(0, 8)}`;
        const port = await freePort();
        const url = `http://localhost:${port}`;
        let expectedRepositories = name === 'local_wildcard' || name === 'local_nested' ? 2 : 1;
        if (name === 'github_org' || name === 'github_user') {
            const endpoint = name === 'github_org' ? 'orgs/chalk' : 'users/octocat';
            const response = await fetch(`https://api.github.com/${endpoint}/repos?per_page=100`);
            assert.ok(response.ok, 'Could not establish expected public repository count');
            const repositories = await response.json();
            assert.ok(repositories.length > 0 && repositories.length < 100, 'Public fixture must fit a single bounded page');
            expectedRepositories = repositories.length;
        }
        const compose = parse(composeSource);
        // Isolation only: leave the generated config, secrets and identity intact.
        compose.services.sourcebot.image = image;
        compose.services.sourcebot.pull_policy = 'never';
        compose.services.sourcebot.container_name = `${project}-sourcebot`;
        compose.services.sourcebot.ports = [`127.0.0.1:${port}:3000`];
        compose.services.sourcebot.environment.push('SOURCEBOT_TELEMETRY_DISABLED=true');
        for (const [service, config] of Object.entries(compose.services)) {
            config.restart = 'no';
            if (service !== 'sourcebot') {
                config.ports = [];
            }
        }
        const report = { scenario: name, project, url, artifactSha256: packed.digest, composeSourceSha256: createHash('sha256').update(composeSource).digest('hex'), status: 'running', image };
        reports.push(report);
        console.log(`Starting live scenario ${name} at ${url}`);
        const aiKey = name === 'anthropic' ? credentials() : undefined;
        const allAi = name === 'ai_all';
        const aiEnabled = Boolean(aiKey) || allAi;
        const fixtureKey = 'fixture-ai-credential-not-real';
        if (name === 'anthropic') {
            assert.ok(aiKey, 'Anthropic development credential missing');
        }
        let context;
        try {
            await scenario(packed, {
                setupName: project,
                realDocker: docker,
                compose: stringify(compose),
                networkModule: './liveNetwork.mjs',
                sensitiveValues: aiKey ? [aiKey] : allAi ? [fixtureKey] : [],
                environment: { COMPOSE_PROJECT_NAME: project, DOCKER_CONFIG: dockerConfig, DOCKER_HOST: dockerHost },
                prepare({ cwd }) {
                    if (name.startsWith('local_')) {
                        const target = join(cwd, 'cloned repos');
                        mkdirSync(target);
                        if (name === 'local_root') {
                            execFileSync('git', ['clone', '--depth=1', 'https://github.com/octocat/Hello-World.git', join(target, 'hello')], { stdio: 'ignore', timeout: 45000 });
                        } else {
                            for (const [index, relative] of (name === 'local_nested' ? ['one', 'nested/two'] : ['one', 'two']).entries()) {
                                // Sourcebot deduplicates clones sharing the same
                                // origin; use two genuinely different repositories.
                                const remote = index === 0 ? 'Hello-World' : 'git-consortium';
                                execFileSync('git', ['clone', '--depth=1', `https://github.com/octocat/${remote}.git`, join(target, relative)], { stdio: 'ignore', timeout: 45000 });
                            }
                        }
                    }
                },
                async verifyDeployment({ setup, files, events }) {
                    const props = event => events.find(item => item.event === `setup_sourcebot_${event}`)?.properties;
                    assert.equal(props('completed').sourcebotStartOutcome, name === 'auto_start' ? 'spawned' : 'declined');
                    const source = props('configured_code_source');
                    assert.equal(source.codeHost, name.startsWith('local_') ? 'local_git' : name === 'remote_git' ? 'remote_git' : name === 'gitlab_project' ? 'gitlab' : name === 'gitea_repo' ? 'gitea' : name === 'gerrit_project' ? 'gerrit' : 'github');
                    assert.equal(source.credentialMode, 'none');
                    assert.equal(source.configurationIndex, 1);
                    assert.equal(source.repositoryCount, ['github_org', 'github_user', 'gitlab_project', 'gerrit_project'].includes(name) ? 0 : name.startsWith('local_') ? expectedRepositories : 1);
                    assert.equal(source.organizationCount, name === 'github_org' ? 1 : 0);
                    assert.equal(source.userCount, name === 'github_user' ? 1 : 0);
                    assert.equal(source.projectCount, ['gitlab_project', 'gerrit_project'].includes(name) ? 1 : 0);
                    assert.equal(source.generatedConnectionCount, name === 'local_nested' ? 2 : 1);
                    assert.equal(props('ai_setup_completed').aiConfigured, aiEnabled);
                    const aiCount = allAi ? providers.length : aiEnabled ? 1 : 0;
                    assert.equal(props('ai_setup_completed').aiConfigurationCount, aiCount);
                    assert.deepEqual(events.filter(event => event.event !== 'setup_sourcebot_failed').map(event => event.event.replace('setup_sourcebot_', '')), [
                        'started', 'chose_setup_directory', 'configured_code_source', 'configured_code_sources',
                        ...Array(aiCount).fill('configured_ai_provider'), 'ai_setup_completed', 'configured_hosted_url',
                        'generated_configs', 'resolved_compose_file', 'validated_docker_state', 'completed',
                    ]);
                    report.telemetryContract = 'passed';
                    chmodSync(join(setup, '.env'), 0o600);
                    const command = ['compose', '-p', project, '--project-directory', setup];
                    run([...command, 'up', '-d', '--pull', 'never']);
                    const began = Date.now();
                    while (true) {
                        try {
                            const response = await fetch(`${url}/onboard`, { signal: AbortSignal.timeout(2000) });
                            if (response.ok) {
                                break;
                            }
                        } catch { /* Startup is asynchronous. */ }
                        assert.ok(Date.now() - began < 120000, 'Sourcebot did not become HTTP-ready within two minutes');
                        await pause(1000);
                    }
                    report.httpReady = true;
                    report.stage = 'identity';
                    const persisted = JSON.parse(run(['exec', `${project}-sourcebot`, 'cat', '/data/.sourcebot/.installedv3']));
                    assert.equal(persisted.install_id, events[0].distinct_id);
                    report.installIdPreserved = true;
                    context = await browser.newContext();
                    const page = await context.newPage();
                    report.stage = 'onboarding';
                    await page.goto(`${url}/onboard`);
                    await page.getByRole('link', { name: /Get Started/ }).click();
                    await page.getByLabel('Email', { exact: true }).fill(`owner-${project}@example.invalid`);
                    await page.getByLabel('Password', { exact: true }).fill(`Test-${randomUUID()}!`);
                    await page.getByRole('button', { name: 'Sign up with credentials' }).click();
                    await page.getByRole('link', { name: /Continue/ }).click({ timeout: 30000 });
                    await page.getByRole('button', { name: /Skip for now|Continue to Sourcebot/ }).click({ timeout: 30000 });
                    await page.waitForURL(current => !current.pathname.startsWith('/onboard'));
                    report.onboarding = 'passed';
                    report.stage = 'indexing';
                    const database = run([...command, 'ps', '-q', 'postgres']).trim();
                    const started = Date.now();
                    let counts;
                    while (true) {
                        counts = JSON.parse(run(['exec', database, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', `SELECT json_build_object('discovered',count(*),'indexed',count("indexedAt")) FROM "Repo";`]));
                        if (counts.indexed === expectedRepositories && counts.discovered === expectedRepositories) {
                            break;
                        }
                        assert.ok(Date.now() - started < 180000, `Repository indexing did not complete: discovered=${counts.discovered}, indexed=${counts.indexed}`);
                        await pause(1000);
                    }
                    report.repositories = counts;
                    report.expectedRepositories = expectedRepositories;
                    report.stage = 'search';
                    const searchQuery = name === 'github_org' ? 'color' : name === 'gitlab_project' ? 'test' : name === 'gitea_repo' ? 'gitea' : name === 'gerrit_project' ? 'readonly' : 'hello';
                    const response = await page.request.post(`${url}/api/search`, { data: { query: searchQuery, matches: 10 } });
                    assert.equal(response.status(), 200, 'Authenticated search failed');
                    const search = await response.json();
                    assert.ok(search.stats?.fileCount > 0, `No search matches; response fields: ${Object.keys(search).join(',')}`);
                    report.searchMatches = search.stats.fileCount;
                    await page.goto(`${url}/search?query=${encodeURIComponent(searchQuery)}`);
                    await page.getByText(/Found \d+ match/).first().waitFor({ timeout: 20000 });
                    report.searchUi = 'passed';
                    if (output) {
                        mkdirSync(output, { recursive: true });
                        await page.screenshot({ path: join(output, `${name}.png`), fullPage: true });
                    }
                    if (name === 'anthropic') {
                        const config = JSON.parse(files['config.json']);
                        assert.equal(config.models[0].provider, 'anthropic');
                        const expectedEnv = dotenv(files['.env']);
                        assert.ok(expectedEnv.ANTHROPIC_API_KEY === aiKey, 'Generated AI credential differs from the supplied credential');
                        const actual = run(['exec', `${project}-sourcebot`, 'node', '-e', 'process.stdout.write(process.env.ANTHROPIC_API_KEY || "")']);
                        assert.ok(actual === aiKey, 'Generated AI credential did not reach the container');
                        report.ai = { configured: true, environmentVerified: true, askRequest: 'not_requested' };
                    }
                    if (allAi) {
                        const config = JSON.parse(files['config.json']);
                        assert.deepEqual(config.models.map(model => model.provider), providers);
                        assert.deepEqual(events.filter(event => event.event === 'setup_sourcebot_configured_ai_provider').map(event => event.properties.provider), providers);
                        const expectedEnv = dotenv(files['.env']);
                        const mountedConfig = JSON.parse(run(['exec', `${project}-sourcebot`, 'cat', '/data/config.json']));
                        assert.deepEqual(mountedConfig, config);
                        const actualEnv = JSON.parse(run(['exec', `${project}-sourcebot`, 'node', '-e', 'process.stdout.write(JSON.stringify(process.env))']));
                        for (const key of Object.keys(expectedEnv)) {
                            assert.ok(actualEnv[key] === expectedEnv[key], `Generated environment mismatch for ${key}`);
                        }
                        for (const model of config.models) {
                            assert.equal(model.model, `fixture-model-${model.provider}`);
                            if (model.token) {
                                assert.ok(expectedEnv[model.token.env] === fixtureKey, 'Model credential reference mismatch');
                            }
                        }
                        report.ai = { providersConfigured: providers.length, environmentVerified: true, credentials: 'synthetic_not_validated', askRequest: 'not_requested' };
                    }
                    run([...command, 'restart', 'sourcebot']);
                    const restartBegan = Date.now();
                    while (true) {
                        try {
                            if ((await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) })).ok) {
                                break;
                            }
                        } catch { /* Wait for the restarted application. */ }
                        assert.ok(Date.now() - restartBegan < 120000, 'Restart did not become HTTP-ready');
                        await pause(1000);
                    }
                    const afterRestart = JSON.parse(run(['exec', `${project}-sourcebot`, 'cat', '/data/.sourcebot/.installedv3']));
                    assert.equal(afterRestart.install_id, persisted.install_id);
                    const restartedSearch = await page.request.post(`${url}/api/search`, { data: { query: searchQuery, matches: 10 } });
                    assert.equal(restartedSearch.status(), 200);
                    assert.ok((await restartedSearch.json()).stats?.fileCount > 0, 'Search stopped working after restart');
                    report.restartIdentity = 'passed';
                    report.status = 'passed';
                },
                async cleanupDeployment({ setup }) {
                    if (output && context && report.status !== 'passed') {
                        await context.pages()[0]?.screenshot({ path: join(output, `${name}-failure.png`), fullPage: true }).catch(() => {});
                    }
                    await context?.close();
                    if (existsSync(join(setup, 'docker-compose.yml'))) {
                        run(['compose', '-p', project, '--project-directory', setup, 'down', '--volumes', '--remove-orphans'], { timeout: 45000 });
                    }
                    assert.equal(run(['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]).trim(), '');
                    assert.equal(run(['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]).trim(), '');
                    report.cleaned = true;
                },
            }, async d => {
                await d.answer('What directory would you like', project);
                if (name.startsWith('local_')) {
                    await d.select('Which code host', 2);
                    await d.answer('Path to your repos directory', join(d.cwd, 'cloned repos', ...(name === 'local_root' ? ['hello'] : [])));
                    if (name !== 'local_root') {
                        await d.answer('Which repositories should be indexed?');
                    }
                } else if (name === 'remote_git') {
                    await d.select('Which code host', 3);
                    await d.answer('Git clone URL', 'https://github.com/octocat/Hello-World.git');
                } else if (name === 'gitea_repo') {
                    await d.select('Which code host', 6);
                    await d.answer('Gitea URL');
                    await d.answer('Gitea Access Token');
                    await d.check('What do you want to index?', [1]);
                    await liveMulti(d, 'Repositories to index', 'gitea/go-sdk');
                } else if (name === 'gerrit_project') {
                    await d.select('Which code host', 7);
                    await d.answer('Gerrit URL', 'https://gerrit-review.googlesource.com');
                    await d.answer('Index all projects?', 'n');
                    await liveMulti(d, 'Projects to index', 'plugins/readonly');
                } else if (name === 'gitlab_project') {
                    await d.select('Which code host', 1);
                    await d.answer('GitLab URL');
                    await d.answer('GitLab Personal Access Token');
                    await d.check('What do you want to index?', [1]);
                    await liveMulti(d, 'Projects to index', 'gitlab-org/gitlab-test');
                } else {
                    await d.select('Which code host');
                    await d.answer('GitHub URL');
                    await d.answer('GitHub Personal Access Token');
                    await d.check('What do you want to index?', [name === 'github_org' ? 1 : name === 'github_user' ? 2 : 0]);
                    await liveMulti(d, name === 'github_org' ? 'Organizations to index' : name === 'github_user' ? 'GitHub users to index' : 'Repositories to index', name === 'github_org' ? 'chalk' : name === 'github_user' ? 'octocat' : 'octocat/Hello-World');
                }
                await d.answer('Add another code host?', 'n');
                await d.answer('Would you like to configure AI features?', aiEnabled ? 'y' : 'n');
                if (allAi) {
                    for (const [index, provider] of providers.entries()) {
                        await d.select('Which AI provider?', index);
                        await d.wait('Model name');
                        await pause(500);
                        d.write(`fixture-model-${provider}`);
                        await pause(700);
                        d.write('\r');
                        if (provider === 'openai-compatible') {
                            await d.answer('Base URL', 'https://fixture-ai.example.invalid/v1');
                        }
                        if (provider === 'azure') {
                            await d.answer('Azure resource name', 'fixture-resource');
                            await d.answer('API version');
                        }
                        if (provider === 'amazon-bedrock') {
                            await d.answer('Use the default AWS credential chain?', 'n');
                            await d.answer('AWS Access Key ID', 'fixture-access-id');
                            await d.answer('AWS Secret Access Key', fixtureKey);
                            await d.answer('AWS region');
                        } else if (provider.startsWith('google-vertex')) {
                            if (provider === 'google-vertex') {
                                await d.answer('Google Cloud project ID', 'fixture-project');
                                await d.answer('Google Cloud region');
                            }
                            await d.answer('Use Application Default Credentials?', 'y');
                        } else {
                            await d.answer('API key (', fixtureKey);
                        }
                        await d.answer('Display name');
                        await d.answer('Add another model?', index === providers.length - 1 ? 'n' : 'y');
                    }
                }
                if (aiKey) {
                    await d.select('Which AI provider?');
                    await d.wait('Model name');
                    await pause(500);
                    d.write('claude-haiku-4-5');
                    await pause(500);
                    d.write('\r');
                    await d.answer('API key (', aiKey);
                    await d.answer('Display name');
                    await d.answer('Add another model?', 'n');
                }
                await d.answer('What URL will Sourcebot be hosted at?', url);
                await d.answer('Download docker-compose.yml?', 'y');
                await d.answer('Start Sourcebot now?', name === 'auto_start' ? 'y' : 'n');
                if (name === 'auto_start') {
                    const began = Date.now();
                    while (true) {
                        try {
                            if ((await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) })).ok) {
                                break;
                            }
                        } catch { /* Compose is starting the actual application. */ }
                        assert.ok(Date.now() - began < 120000, 'CLI-started deployment did not become healthy');
                        await pause(1000);
                    }
                    report.cliStartedDeployment = true;
                    d.write('\x03');
                    await d.finish(130);
                    assert.equal(d.events.filter(event => event.event === 'setup_sourcebot_completed').length, 1);
                    assert.equal(d.events.some(event => event.event === 'setup_sourcebot_cancelled'), false);
                }
            });
        } catch (error) {
            report.status = 'failed';
            report.failure = (aiKey ? error.message.replaceAll(aiKey, '[redacted]') : error.message).slice(0, 500);
        }
        console.log(JSON.stringify(report));
        if (output) {
            const path = join(output, 'live-results.json');
            const previous = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
            writeFileSync(path, JSON.stringify([...previous.filter(item => !reports.some(report => report.scenario === item.scenario)), ...reports], null, 2));
        }
    }
    process.exitCode = reports.some(report => report.status !== 'passed') ? 1 : 0;
} finally {
    await browser?.close();
    packed.cleanup();
}
