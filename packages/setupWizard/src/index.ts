#!/usr/bin/env node
import { confirm, input, select } from './prompts.js';
import chalk from 'chalk';
import { spinner } from './spinner.js';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { lifecycle, wizardFetch } from './lifecycle.js';
import { invocationMethod } from './telemetry.js';
import {
    aggregateSources,
    aggregateAi,
    hostCategory,
    selectInstallId,
    emptyDockerSummary,
    dockerOutcome,
} from './telemetrySummary.js';
import { Docker } from './docker.js';
import type { CodeSourceSummary, Events } from './telemetryEvents.js';
import net from 'node:net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { basename, join } from 'path';
import { collectAzureDevOpsConfig } from './azuredevops.js';
import { collectBitbucketConfig } from './bitbucket.js';
import { collectGenericGitConfig } from './genericGit.js';
import { collectGerritConfig } from './gerrit.js';
import { collectGiteaConfig } from './gitea.js';
import { collectGitHubConfig } from './github.js';
import { collectGitLabConfig } from './gitlab.js';
import { collectLocalReposConfig } from './localRepos.js';
import { collectModels, PROVIDER_ENV_KEYS } from './models.js';
import {
    type CollectResult,
    type ConnectionConfig,
    type EnvVars,
    generateConnectionName,
    generateSecret,
    INPUT_THEME,
    note,
} from './utils.js';

const DOCKER_COMPOSE_BRANCH = 'main';
const DOCKER_COMPOSE_URL = `https://raw.githubusercontent.com/sourcebot-dev/sourcebot/${DOCKER_COMPOSE_BRANCH}/docker-compose.yml`;

const SOURCEBOT_URL = 'http://localhost:3000';

// Render an OSC 8 terminal hyperlink. Terminals that support it show `label`
// as a clickable link to `url`; others fall back to just the styled label.
function hyperlink(label: string, url: string): string {
    const OSC = ']8;;';
    const ST = '';
    return `${OSC}${url}${ST}${label}${OSC}${ST}`;
}

// Wrap `text` to `width` columns, prefixing every line with `indent`.
function wrapText(text: string, indent: string, width: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        if (current.length > 0 && current.length + 1 + word.length > width) {
            lines.push(indent + current);
            current = word;
        } else {
            current = current.length > 0 ? `${current} ${word}` : word;
        }
    }
    if (current.length > 0) {
        lines.push(indent + current);
    }
    return lines;
}

function openBrowser(url: string): void {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
    lifecycle.check();
    const browser = spawn(cmd, args, { stdio: 'ignore', detached: true });
    browser.on('error', () => {});
    browser.unref();
}

async function openBrowserWhenReady(url: string, signal: AbortSignal, timeoutMs = 120_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await wizardFetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]) });
            if (res.status < 500) {
                signal.throwIfAborted();
                openBrowser(url);
                return;
            }
        } catch {
            // not yet ready
        }
        await sleep(2000, undefined, { signal });
    }
}

// Parses the top-level `volumes:` block of a docker-compose.yml and returns the
// declared volume names. Sufficient for our generated compose file; not a full
// YAML parser.
function parseTopLevelVolumes(composeYaml: string): string[] {
    const names: string[] = [];
    let inBlock = false;
    for (const rawLine of composeYaml.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (/^volumes:\s*(#.*)?$/.test(line)) {
            inBlock = true;
            continue;
        }
        if (!inBlock) {
            continue;
        }
        if (/^\s*$/.test(line) || /^\s+/.test(line)) {
            const m = line.match(/^ {2}([A-Za-z0-9_.-]+):\s*(#.*)?$/);
            if (m) {
                names.push(m[1]);
            }
            continue;
        }
        // Any non-blank, non-indented line ends the top-level volumes block.
        inBlock = false;
    }
    return names;
}

// A published port from a compose `ports:` entry, with the host interface Docker
// would bind to. Container-only, range, and env-interpolated specs are skipped.
type PublishedPort = { host: string; port: number };

// Parses a single compose short-syntax port spec (e.g. "3000:3000",
// "127.0.0.1:5432:5432", "8080:80/tcp") into the host interface + port. Returns
// undefined for specs with no fixed host port (container-only, ranges, ${VAR}).
function parseHostPortSpec(spec: string): PublishedPort | undefined {
    let s = spec.trim();
    s = s.replace(/\s+#.*$/, '').trim(); // strip inline comment
    s = s.replace(/^["']|["']$/g, '').trim(); // strip surrounding quotes
    s = s.replace(/\/(tcp|udp|sctp)$/i, ''); // strip protocol suffix
    const parts = s.split(':');
    let host = '0.0.0.0';
    let hostPort: string;
    if (parts.length === 1) {
        // Only a container port given — Docker picks a random host port, nothing to check.
        return undefined;
    } else if (parts.length === 2) {
        hostPort = parts[0];
    } else {
        // IP:HOST:CONTAINER
        host = parts[parts.length - 3];
        hostPort = parts[parts.length - 2];
    }
    // Skip port ranges (e.g. "8000-8010") and env-interpolated values (e.g. "${PORT}").
    if (!/^\d+$/.test(hostPort)) {
        return undefined;
    }
    return { host, port: Number(hostPort) };
}

// Parses every `ports:` block in a docker-compose.yml and returns the unique set
// of host ports it would publish. Sufficient for our generated compose file; not a
// full YAML parser.
function parsePublishedHostPorts(composeYaml: string): PublishedPort[] {
    const ports: PublishedPort[] = [];
    let blockIndent = -1;
    for (const rawLine of composeYaml.split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (/^\s*$/.test(line)) {
            continue;
        }
        const indent = line.length - line.trimStart().length;
        const portsKey = line.match(/^(\s*)ports:\s*(#.*)?$/);
        if (portsKey) {
            blockIndent = portsKey[1].length;
            continue;
        }
        if (blockIndent < 0) {
            continue;
        }
        const item = line.match(/^\s*-\s*(.+?)\s*$/);
        if (item && indent > blockIndent) {
            const parsed = parseHostPortSpec(item[1]);
            if (parsed) {
                ports.push(parsed);
            }
            continue;
        }
        // Any non-list line (a sibling key or dedent) ends the ports block.
        blockIndent = -1;
    }
    const seen = new Set<string>();
    return ports.filter((p) => {
        const key = `${p.host}:${p.port}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

// Authoritatively checks whether a host port is already bound by attempting to bind
// it ourselves — this catches any process (Docker or not, e.g. a local Postgres on
// 5432), which is the actual failure mode `docker compose up` hits.
function isPortInUse({ host, port }: PublishedPort): Promise<boolean> {
    return new Promise((resolve) => {
        lifecycle.check();
        const server = net.createServer();
        const release = lifecycle.own(() => server.close());
        server.once('close', release);
        server.once('error', (err: NodeJS.ErrnoException) => {
            server.close(() => {
                /* noop */
            });
            // EADDRINUSE = taken. Other errors (e.g. EACCES on privileged ports) aren't
            // a "someone else has it" conflict we can meaningfully report, so treat as free.
            if (err.code !== 'EADDRINUSE') {
                portInspectionFailed = true;
                docker.failed = true;
                lifecycle.fail('validation', true);
            }
            resolve(err.code === 'EADDRINUSE');
        });
        server.once('listening', () => {
            server.close(() => resolve(false));
        });
        if (host === '0.0.0.0') {
            server.listen(port);
        } else {
            server.listen(port, host);
        }
    });
}

const docker = new Docker((category) => lifecycle.fail(category, true));
let portInspectionFailed = false;
function dockerComposeProjectName(): string {
    return basename(process.cwd())
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
}

const PLATFORM_LABELS: Record<string, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket',
    gitea: 'Gitea',
    azuredevops: 'Azure DevOps',
    gerrit: 'Gerrit',
    local: 'Local Git repositories',
    git: 'Other Git host',
};

async function main() {
    lifecycle.install();
    lifecycle.capture('started', { invocationMethod: invocationMethod(), isInteractive: !!process.stdin.isTTY });
    lifecycle.failureCategory = 'filesystem';
    console.log(String.raw`
███████╗ ██████╗ ██╗   ██╗██████╗  ██████╗███████╗██████╗  ██████╗ ████████╗
██╔════╝██╔═══██╗██║   ██║██╔══██╗██╔════╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝
███████╗██║   ██║██║   ██║██████╔╝██║     █████╗  ██████╔╝██║   ██║   ██║
╚════██║██║   ██║██║   ██║██╔══██╗██║     ██╔══╝  ██╔══██╗██║   ██║   ██║
███████║╚██████╔╝╚██████╔╝██║  ██║╚██████╗███████╗██████╔╝╚██████╔╝   ██║██╗
╚══════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚══════╝╚═════╝  ╚═════╝    ╚═╝╚═╝
`);

    const setupDir = await input({
        message: 'What directory would you like to set up Sourcebot in?',
        default: 'sourcebot',
        theme: INPUT_THEME,
        validate: (v: string) => {
            if (!v?.trim()) {
                return 'Directory is required';
            }
            return true;
        },
    });

    const selectedDirectoryExisted = existsSync(setupDir);
    if (selectedDirectoryExisted) {
        const overwrite = await confirm({
            message: `Directory '${setupDir}' already exists. Do you want to overwrite it?`,
            default: false,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'Setup cancelled.');
            await lifecycle.decline('existing_directory_declined');
            return;
        }
    } else {
        mkdirSync(setupDir, { recursive: true });
    }

    lifecycle.check();
    process.chdir(setupDir);
    lifecycle.capture('chose_setup_directory', {
        usedDefaultDirectory: setupDir === 'sourcebot',
        directoryExisted: selectedDirectoryExisted,
        directoryAction: selectedDirectoryExisted ? 'existing_directory_accepted' : 'created',
    });
    lifecycle.stage = 'code_sources';
    lifecycle.failureCategory = 'unknown';
    const sourceSummaries: CodeSourceSummary[] = [];

    const connections: Record<string, ConnectionConfig> = {};
    const allEnv: EnvVars = {};
    const localRepoIndex = new Map<string, number>();

    note('Code is cloned and indexed locally on this machine. No code is ever transmitted to Sourcebot.');

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const platform = await select<string>({
            message: 'Which code host do you want to connect?',
            loop: false,
            choices: [
                {
                    value: 'github',
                    name: 'GitHub',
                    description: 'github.com, GitHub Enterprise Server, or GitHub Enterprise Cloud',
                },
                {
                    value: 'gitlab',
                    name: 'GitLab',
                    description: 'gitlab.com, GitLab Self Managed, or GitLab Dedicated',
                },
                {
                    value: 'local',
                    name: 'Local git repositories',
                    description: 'git repositories in a local directory',
                },
                { value: 'git', name: 'Remote git repository', description: 'Arbitrary git URL' },
                { value: 'azuredevops', name: 'Azure DevOps', description: 'dev.azure.com or Azure Devops Server' },
                { value: 'bitbucket', name: 'Bitbucket', description: 'Bitbucket Cloud or Bitbucket Data Center' },
                { value: 'gitea', name: 'Gitea', description: 'Gitea Cloud or Gitea self-hosted' },
                { value: 'gerrit', name: 'Gerrit' },
            ],
        });

        const connectionName = generateConnectionName(platform, connections);

        note(`Configuring ${PLATFORM_LABELS[platform] ?? platform}`, connectionName);

        let result: CollectResult;

        switch (platform) {
            case 'github':
                result = await collectGitHubConfig(connectionName);
                break;
            case 'gitlab':
                result = await collectGitLabConfig(connectionName);
                break;
            case 'bitbucket':
                result = await collectBitbucketConfig(connectionName);
                break;
            case 'gitea':
                result = await collectGiteaConfig(connectionName);
                break;
            case 'azuredevops':
                result = await collectAzureDevOpsConfig(connectionName);
                break;
            case 'gerrit':
                result = await collectGerritConfig();
                break;
            case 'local':
                result = await collectLocalReposConfig(localRepoIndex);
                break;
            case 'git':
                result = await collectGenericGitConfig();
                break;
            default:
                continue;
        }

        lifecycle.check();
        sourceSummaries.push(result.telemetry);
        lifecycle.capture('configured_code_source', {
            configurationIndex: sourceSummaries.length,
            ...result.telemetry,
        });
        for (const { name, config } of result.connections) {
            const finalName = name ? generateConnectionName(name, connections) : connectionName;
            connections[finalName] = config;
        }
        Object.assign(allEnv, result.env);

        const addAnother = await confirm({
            message: 'Add another code host?',
            default: false,
        });

        if (!addAnother) {
            break;
        }
    }

    const sourceSummary = aggregateSources(sourceSummaries);
    lifecycle.capture('configured_code_sources', sourceSummary);
    lifecycle.stage = 'ai_setup';
    let modelIndex = 0;
    const {
        models,
        env: modelEnv,
        telemetry: modelSummaries,
    } = await collectModels((summary) => {
        lifecycle.capture('configured_ai_provider', { configurationIndex: ++modelIndex, ...summary });
    });
    const aiSummary = aggregateAi(modelSummaries);
    lifecycle.capture('ai_setup_completed', aiSummary);
    lifecycle.stage = 'hosted_url';
    Object.assign(allEnv, modelEnv);

    const authUrl = await input({
        message: 'What URL will Sourcebot be hosted at?',
        default: SOURCEBOT_URL,
        theme: INPUT_THEME,
        validate: (v) => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
            return true;
        },
    });
    allEnv.AUTH_URL = authUrl;
    lifecycle.capture('configured_hosted_url', {
        usedDefaultUrl: authUrl === SOURCEBOT_URL,
        protocol: authUrl.startsWith('https:') ? 'https' : 'http',
        hostCategory: hostCategory(authUrl),
    });
    lifecycle.stage = 'config_overwrite';
    lifecycle.failureCategory = 'filesystem';
    const overwritten: Events['generated_configs']['overwroteExistingFiles'] = [];

    if (existsSync('config.json')) {
        overwritten.push('config_json');
        const overwrite = await confirm({
            message: 'config.json already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'config.json was not overwritten.');
            await lifecycle.decline('config_overwrite_declined');
            return;
        }
    }

    if (existsSync('.env')) {
        overwritten.push('env');
        const overwrite = await confirm({
            message: '.env already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + '.env was not overwritten.');
            await lifecycle.decline('config_overwrite_declined');
            return;
        }
    }

    if (localRepoIndex.size > 0 && existsSync('docker-compose.override.yml')) {
        overwritten.push('compose_override');
        const overwrite = await confirm({
            message: 'docker-compose.override.yml already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'docker-compose.override.yml was not overwritten.');
            await lifecycle.decline('config_overwrite_declined');
            return;
        }
    }

    lifecycle.check();
    const deploymentIdentity = selectInstallId(
        existsSync('.env') ? readFileSync('.env', 'utf8') : '',
        lifecycle.telemetry.setupSessionId,
    );
    const s = spinner('Writing configuration files...');
    const releaseWriter = lifecycle.own(() => s.stop());

    const configOutput: Record<string, unknown> = {
        $schema: 'https://raw.githubusercontent.com/sourcebot-dev/sourcebot/main/schemas/v3/index.json',
        connections,
    };
    if (models.length > 0) {
        configOutput.models = models;
    }
    const configJson = JSON.stringify(configOutput, null, 4);

    const TOP_LEVEL_ENV_KEYS = ['AUTH_URL'];
    const connectionEnv = Object.fromEntries(
        Object.entries(allEnv).filter(
            ([k]) =>
                !Object.values(PROVIDER_ENV_KEYS).includes(k) &&
                !['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(k) &&
                !TOP_LEVEL_ENV_KEYS.includes(k),
        ),
    );
    const aiEnv = Object.fromEntries(
        Object.entries(allEnv).filter(
            ([k]) =>
                Object.values(PROVIDER_ENV_KEYS).includes(k) ||
                ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(k),
        ),
    );

    const envLines: string[] = [
        '# Generated by setup-sourcebot',
        '',
        '# Auto-generated secrets — do not change after first run',
        `AUTH_SECRET=${generateSecret(33)}`,
        `SOURCEBOT_ENCRYPTION_KEY=${generateSecret(24)}`,
        '',
        '# Public URL where Sourcebot is hosted',
        `AUTH_URL=${allEnv.AUTH_URL}`,
    ];

    if (deploymentIdentity.id) {
        envLines.push('', '# Deployment identifier', `SOURCEBOT_INSTALL_ID=${deploymentIdentity.id}`);
    }

    if (Object.keys(connectionEnv).length > 0) {
        envLines.push('', '# Code host credentials');
        for (const [key, value] of Object.entries(connectionEnv)) {
            envLines.push(`${key}=${value}`);
        }
    }

    if (Object.keys(aiEnv).length > 0) {
        envLines.push('', '# AI provider credentials');
        for (const [key, value] of Object.entries(aiEnv)) {
            envLines.push(`${key}=${value}`);
        }
    }

    lifecycle.check();
    writeFileSync('config.json', configJson + '\n');
    writeFileSync('.env', envLines.join('\n') + '\n');

    const writtenFiles = ['config.json', '.env'];

    if (localRepoIndex.size > 0) {
        const mounts = [...localRepoIndex.entries()]
            .sort((a, b) => a[1] - b[1])
            .map(([p, i]) => `      - ${p}:/repos/${i}:ro`);
        const overrideYaml = [
            '# Generated by setup-sourcebot',
            '# Merged with docker-compose.yml at `docker compose up` time.',
            'services:',
            '  sourcebot:',
            '    volumes:',
            ...mounts,
            '',
        ].join('\n');
        writeFileSync('docker-compose.override.yml', overrideYaml);
        writtenFiles.push('docker-compose.override.yml');
    }

    lifecycle.capture('generated_configs', {
        filesWritten: ['config_json', 'env', ...(localRepoIndex.size > 0 ? ['compose_override' as const] : [])],
        overwroteExistingFiles: overwritten,
        wroteComposeOverride: localRepoIndex.size > 0,
        localMountCount: localRepoIndex.size,
        generatedConnectionCount: sourceSummary.generatedConnectionCount,
        aiConfigurationCount: aiSummary.aiConfigurationCount,
        credentialVariableCount:
            Object.keys(connectionEnv).filter((k) => !['GOOGLE_VERTEX_PROJECT', 'GOOGLE_VERTEX_REGION'].includes(k))
                .length + Object.keys(aiEnv).length,
        deploymentIdentityAction: deploymentIdentity.action,
    });
    releaseWriter();
    const fileInfo: Record<string, { description: string; docsLabel?: string; docsUrl?: string }> = {
        'config.json': {
            description:
                'The Sourcebot configuration file. This controls which repos Sourcebot indexes and which language models it connects to.',
            docsLabel: 'Configuration file docs',
            docsUrl: 'https://docs.sourcebot.dev/docs/configuration/config-file',
        },
        '.env': {
            description:
                'The environment file your Sourcebot deployment will load. This includes any of the access tokens you provided here, as well as generated secrets required to run Sourcebot.',
            docsLabel: 'Environment variables docs',
            docsUrl: 'https://docs.sourcebot.dev/docs/configuration/environment-variables',
        },
        'docker-compose.override.yml': {
            description:
                'Mounts your local repositories into the Sourcebot container so they can be indexed. Merged with docker-compose.yml at `docker compose up` time.',
        },
    };

    const wrapWidth = Math.min((process.stdout.columns || 80) - 6, 90);

    const fileLines = writtenFiles.flatMap((file) => {
        const fullPath = join(process.cwd(), file);
        const info = fileInfo[file];
        const lines = [
            `  ${chalk.green('✓')} ${chalk.bold.cyan(file)} ${chalk.dim(hyperlink(fullPath, `file://${fullPath}`))}`,
        ];
        if (info) {
            lines.push(...wrapText(info.description, '    ', wrapWidth));
            if (info.docsLabel && info.docsUrl) {
                lines.push(`    ${chalk.blue('↗')} ${chalk.blue.underline(hyperlink(info.docsLabel, info.docsUrl))}`);
            }
        }
        lines.push('');
        return lines;
    });

    s.succeed(chalk.bold('Wrote the following files:'));
    console.log(['', ...fileLines].join('\n'));

    lifecycle.stage = 'compose_file';
    let downloadedCompose = false;
    const compose: Events['resolved_compose_file'] = {
        outcome: 'already_present',
        composeAvailable: true,
        downloadPromptShown: false,
        downloadAttempted: false,
        failureCategory: null,
    };

    if (!existsSync('docker-compose.yml')) {
        compose.downloadPromptShown = true;
        compose.outcome = 'declined';
        compose.composeAvailable = false;
        const download = await confirm({
            message: 'Download docker-compose.yml?',
            default: true,
        });

        if (download) {
            compose.downloadAttempted = true;
            let downloadFailure: NonNullable<Events['resolved_compose_file']['failureCategory']> = 'network';
            const ds = spinner('Downloading docker-compose.yml...');
            try {
                const res = await wizardFetch(DOCKER_COMPOSE_URL);
                downloadFailure = res.status >= 500 ? 'http_5xx' : res.status >= 400 ? 'http_4xx' : 'network';
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                const body = await res.text();
                lifecycle.check();
                downloadFailure = 'filesystem';
                await writeFile('docker-compose.yml', body);
                ds.succeed('Downloaded docker-compose.yml');
                downloadedCompose = true;
                compose.outcome = 'downloaded';
                compose.composeAvailable = true;
            } catch {
                lifecycle.check();
                compose.outcome = 'download_failed';
                compose.failureCategory = downloadFailure;
                lifecycle.fail(downloadFailure === 'filesystem' ? 'filesystem' : 'network', true);
                ds.fail('Download failed — you can get it manually (see next steps)');
            }
        }
    } else {
        downloadedCompose = true;
    }

    lifecycle.capture('resolved_compose_file', compose);
    lifecycle.stage = 'docker_validation';
    lifecycle.failureCategory = 'docker_command';
    const dockerSummary = emptyDockerSummary();
    let leftDeploymentRunning = false;

    if (downloadedCompose) {
        const containerResult = await docker.containers();
        const containers = containerResult.ok ? containerResult.value : [];
        const running = containers.filter((c) => c.State === 'running');
        const stopped = containers.filter((c) => c.State !== 'running');
        if (containerResult.ok) {
            dockerSummary.runningComposeContainerCount = running.length;
            dockerSummary.stoppedComposeContainerCount = stopped.length;
            dockerSummary.composeContainerState = running.length
                ? stopped.length
                    ? 'mixed'
                    : 'running'
                : stopped.length
                  ? 'stopped'
                  : 'none';
        }

        if (running.length > 0) {
            console.log();
            console.log(chalk.yellow('⚠ ') + 'A Sourcebot deployment is already running in this project:');
            for (const c of running) {
                console.log('  ' + chalk.dim('- ') + `${c.Name} ${chalk.dim(`(${c.Service})`)}`);
            }
            const stop = await confirm({
                message:
                    'Stop and remove the running deployment? (required before any volume changes or restart can apply)',
                default: true,
            });
            if (stop) {
                const ds = spinner('Stopping deployment...');
                const ok = (await docker.run(['compose', 'down'])).ok;
                dockerSummary.existingDeploymentAction = ok ? 'stopped' : 'stop_failed';
                if (ok) {
                    ds.succeed('Stopped deployment');
                } else {
                    ds.fail('Failed to stop deployment');
                    leftDeploymentRunning = true;
                }
            } else {
                dockerSummary.existingDeploymentAction = 'left_running';
                leftDeploymentRunning = true;
            }
        } else if (stopped.length > 0) {
            console.log();
            console.log(
                chalk.yellow('⚠ ') + 'Stopped containers from a previous run exist and will conflict on next start:',
            );
            for (const c of stopped) {
                console.log('  ' + chalk.dim('- ') + `${c.Name} ${chalk.dim(`(${c.Service})`)}`);
            }
            const remove = await confirm({
                message: 'Remove them now to prevent name conflicts when Sourcebot starts?',
                default: true,
            });
            dockerSummary.stoppedContainerAction = 'kept';
            if (remove) {
                const rs = spinner('Removing containers...');
                const ok = (await docker.run(['compose', 'rm', '-f'])).ok;
                dockerSummary.stoppedContainerAction = ok ? 'removed' : 'remove_failed';
                if (ok) {
                    rs.succeed('Removed containers');
                } else {
                    rs.fail('Failed to remove containers');
                }
            }
        }
    }

    // Volume wipe is only safe (and only succeeds) once nothing is using the volumes.
    if (downloadedCompose && !leftDeploymentRunning) {
        const declaredVolumes = parseTopLevelVolumes(readFileSync('docker-compose.yml', 'utf-8'));
        const project = dockerComposeProjectName();
        const expectedNames = declaredVolumes.map((v) => `${project}_${v}`);
        const volumeResult = await docker.volumes(expectedNames);
        const existing = volumeResult.ok ? volumeResult.value : [];
        dockerSummary.existingVolumeCount = volumeResult.ok ? existing.length : null;

        if (existing.length > 0) {
            console.log();
            console.log(chalk.yellow('⚠ ') + 'The following Docker volumes from a previous run already exist:');
            for (const v of existing) {
                console.log('  ' + chalk.dim('- ') + v);
            }
            const wipe = await confirm({
                message: 'Wipe these volumes? This will permanently delete any existing Sourcebot data in them.',
                default: false,
            });
            dockerSummary.volumeAction = 'kept';
            if (wipe) {
                const ws = spinner('Removing volumes...');
                const ok = (await docker.run(['volume', 'rm', ...existing])).ok;
                dockerSummary.volumeAction = ok ? 'removed' : 'remove_failed';
                if (ok) {
                    ws.succeed(`Removed ${existing.length} volume${existing.length === 1 ? '' : 's'}`);
                } else {
                    ws.fail('Failed to remove one or more volumes (they may be in use by a running container)');
                }
            }
        }
    }

    // Check that the host ports the compose file publishes are free, so `docker compose up`
    // doesn't fail with "Bind for 0.0.0.0:<port> failed: port is already allocated". Runs
    // after the cleanup above so our own just-stopped containers don't count as conflicts.
    let hasPortConflicts = false;
    if (downloadedCompose && !leftDeploymentRunning) {
        let composeYaml = readFileSync('docker-compose.yml', 'utf-8');
        if (existsSync('docker-compose.override.yml')) {
            composeYaml += '\n' + readFileSync('docker-compose.override.yml', 'utf-8');
        }
        const publishedPorts = parsePublishedHostPorts(composeYaml);

        if (publishedPorts.length === 0) {
            dockerSummary.initialPortConflictCount = 0;
            dockerSummary.remainingPortConflictCount = 0;
            dockerSummary.portConflictSource = 'none';
        }
        if (publishedPorts.length > 0) {
            const ps = spinner('Checking for port conflicts...');
            // Detect via two complementary sources: `docker ps` (authoritative for ports
            // published by other containers — a plain socket bind can't see those reliably,
            // e.g. Docker Desktop on macOS lets us bind a port it already forwards), and a
            // socket bind (catches non-Docker processes like a local Postgres/Redis).
            const ownersResult = await docker.portOwners();
            const owners = ownersResult.ok ? ownersResult.value : new Map<number, string[]>();
            const inUse: PublishedPort[] = [];
            for (const p of publishedPorts) {
                const ownedByContainer = (owners.get(p.port)?.length ?? 0) > 0;
                if (ownedByContainer || (await isPortInUse(p))) {
                    inUse.push(p);
                }
            }
            if (ownersResult.ok && !portInspectionFailed) {
                dockerSummary.initialPortConflictCount = inUse.length;
                dockerSummary.remainingPortConflictCount = inUse.length;
                const dockerOwned = inUse.filter((p) => owners.has(p.port)).length;
                dockerSummary.portConflictSource = !inUse.length
                    ? 'none'
                    : dockerOwned === inUse.length
                      ? 'docker'
                      : dockerOwned === 0
                        ? 'non_docker'
                        : 'mixed';
            }
            if (inUse.length === 0) {
                ps.succeed('No port conflicts detected');
            } else {
                ps.fail(`Port conflict${inUse.length === 1 ? '' : 's'} detected`);
                hasPortConflicts = true;
                console.log();
                console.log(chalk.yellow('⚠ ') + 'The following host ports Sourcebot needs are already in use:');
                for (const p of inUse) {
                    const display = p.host === '0.0.0.0' ? `${p.port}` : `${p.host}:${p.port}`;
                    const by = owners.get(p.port);
                    const suffix =
                        by && by.length > 0 ? chalk.dim(` (in use by Docker container ${by.join(', ')})`) : '';
                    console.log('  ' + chalk.dim('- ') + display + suffix);
                }

                // Containers we can stop ourselves; ports held by non-Docker processes we can't.
                const conflictingContainers = [...new Set(inUse.flatMap((p) => owners.get(p.port) ?? []))];

                if (conflictingContainers.length > 0) {
                    console.log();
                    const stop = await confirm({
                        message: `Stop ${conflictingContainers.length === 1 ? 'this container' : 'these containers'} (${conflictingContainers.join(', ')}) to free the ports?`,
                        default: true,
                    });
                    dockerSummary.portConflictAction = 'kept';
                    if (stop) {
                        const ss = spinner('Stopping containers...');
                        const ok = (await docker.run(['stop', ...conflictingContainers])).ok;
                        dockerSummary.portConflictAction = ok ? 'containers_stopped' : 'stop_failed';
                        if (ok) {
                            ss.succeed(`Stopped ${conflictingContainers.join(', ')}`);
                        } else {
                            ss.fail('Failed to stop one or more containers');
                        }
                        // Re-check the conflicting ports now that the containers are stopped.
                        const stillInUse: PublishedPort[] = [];
                        portInspectionFailed = false;
                        const freshResult = await docker.portOwners();
                        const freshOwners = freshResult.ok ? freshResult.value : new Map<number, string[]>();
                        for (const p of inUse) {
                            const ownedByContainer = (freshOwners.get(p.port)?.length ?? 0) > 0;
                            if (ownedByContainer || (await isPortInUse(p))) {
                                stillInUse.push(p);
                            }
                        }
                        dockerSummary.remainingPortConflictCount =
                            freshResult.ok && !portInspectionFailed ? stillInUse.length : null;
                        if (stillInUse.length === 0) {
                            hasPortConflicts = false;
                            console.log(chalk.green('✓ ') + 'All required ports are now free');
                        } else {
                            console.log();
                            console.log(
                                chalk.yellow('⚠ ') + 'These ports are still in use (likely a non-Docker process):',
                            );
                            for (const p of stillInUse) {
                                const display = p.host === '0.0.0.0' ? `${p.port}` : `${p.host}:${p.port}`;
                                console.log('  ' + chalk.dim('- ') + display);
                            }
                        }
                    }
                }

                if (hasPortConflicts) {
                    console.log();
                    console.log(
                        chalk.dim('  Free these ports (stop the process or container using them), or change the host'),
                    );
                    console.log(chalk.dim('  port mappings in docker-compose.yml, before starting Sourcebot.'));
                }
            }
        }
    }

    dockerSummary.dockerStatus = docker.status;
    dockerSummary.leftExistingDeploymentRunning = leftDeploymentRunning;
    dockerSummary.outcome = dockerOutcome(dockerSummary, downloadedCompose, docker.failed);
    lifecycle.capture('validated_docker_state', dockerSummary);
    lifecycle.stage = 'start';
    lifecycle.failureCategory = 'process_spawn';
    const completion: Events['completed'] = {
        completionMode: leftDeploymentRunning ? 'existing_deployment_left_running' : 'manual_start_required',
        sourcebotStartOffered: downloadedCompose && !leftDeploymentRunning,
        sourcebotStartRequested: false,
        sourcebotStartOutcome: 'not_offered',
        composeAvailable: downloadedCompose,
        dockerValidationOutcome: dockerSummary.outcome,
        remainingPortConflictCount: dockerSummary.remainingPortConflictCount,
        generatedConnectionCount: sourceSummary.generatedConnectionCount,
        codeHostTypes: sourceSummary.codeHostTypes,
        repositoryCount: sourceSummary.repositoryCount,
        aiConfigured: aiSummary.aiConfigured,
        aiConfigurationCount: aiSummary.aiConfigurationCount,
        providerTypes: aiSummary.providerTypes,
        deploymentIdentityAction: deploymentIdentity.action,
        totalDurationMs: 0,
    };
    const complete = () => lifecycle.complete({ ...completion, totalDurationMs: lifecycle.telemetry.elapsed() });
    if (downloadedCompose && !leftDeploymentRunning) {
        const startNow = await confirm({
            message: hasPortConflicts
                ? 'Start Sourcebot anyway? (runs `docker compose up` — will fail until the ports above are free)'
                : 'Start Sourcebot now? (runs `docker compose up`)',
            default: !hasPortConflicts,
        });

        if (startNow) {
            note(
                `Sourcebot will open at ${SOURCEBOT_URL} once it's ready.\nPress Ctrl+C to stop.`,
                'Starting Sourcebot',
            );
            lifecycle.check();
            completion.sourcebotStartRequested = true;
            const readiness = new AbortController();
            const releaseReadiness = lifecycle.own(() => readiness.abort());
            let spawned = false;
            await new Promise<void>((resolve) => {
                const child = lifecycle.child(
                    spawn('docker', ['compose', 'up'], { stdio: 'inherit', detached: process.platform !== 'win32' }),
                );
                child.once('spawn', () => {
                    if (lifecycle.interrupted) {
                        child.kill();
                        return;
                    }
                    spawned = true;
                    completion.sourcebotStartOutcome = 'spawned';
                    completion.completionMode = 'sourcebot_start_spawned';
                    void complete();
                    void openBrowserWhenReady(
                        SOURCEBOT_URL,
                        AbortSignal.any([lifecycle.signal, readiness.signal]),
                    ).catch(() => {});
                });
                child.once('close', () => {
                    readiness.abort();
                    resolve();
                });
                child.once('error', (error: NodeJS.ErrnoException) => {
                    readiness.abort();
                    if (!lifecycle.interrupted) {
                        lifecycle.fail(
                            error.code === 'ENOENT' || error.code === 'EACCES' ? 'docker_unavailable' : 'process_spawn',
                            true,
                        );
                        completion.sourcebotStartOutcome = 'spawn_failed';
                        completion.completionMode = 'sourcebot_start_failed';
                        console.error(chalk.red('✗ ') + 'Failed to run docker compose up.');
                    }
                    resolve();
                });
            });
            readiness.abort();
            releaseReadiness();
            lifecycle.check();
            if (spawned) {
                await lifecycle.telemetry.shutdown();
                return;
            }
        } else {
            completion.sourcebotStartOutcome = 'declined';
        }
    }

    const nextSteps: string[] = [];
    let step = 1;

    if (leftDeploymentRunning) {
        nextSteps.push('Your new configuration was saved, but the running deployment is still using the old config.');
        nextSteps.push('');
        nextSteps.push(`${step++}. Open ${SOURCEBOT_URL} to use the current deployment as-is.`);
        nextSteps.push('');
        nextSteps.push(`${step++}. To apply your new configuration, restart Sourcebot:`);
        nextSteps.push('   docker compose down && docker compose up');
        note(nextSteps.join('\n'), 'Sourcebot is already running');
        await complete();
        return;
    }

    if (!downloadedCompose) {
        nextSteps.push(`${step++}. Download docker-compose.yml:`);
        nextSteps.push(`   curl -o docker-compose.yml ${DOCKER_COMPOSE_URL}`);
        nextSteps.push('');
    }

    if (hasPortConflicts) {
        nextSteps.push(
            `${step++}. Free the host ports listed above (or change the host port mappings in docker-compose.yml).`,
        );
        nextSteps.push('');
    }

    nextSteps.push(`${step++}. Start Sourcebot:`);
    nextSteps.push('   docker compose up');
    nextSteps.push('');
    nextSteps.push(`${step}. Open ${SOURCEBOT_URL}`);

    note(nextSteps.join('\n'), 'Next steps');
    await complete();
}

main()
    .catch(async (error) => {
        if (lifecycle.interrupted) {
            return;
        }
        if (error instanceof Error && error.name === 'ExitPromptError') {
            lifecycle.interrupt();
            return;
        }
        const code = error && typeof error === 'object' ? error.code : undefined;
        const category = ['ENOENT', 'ENOTDIR', 'EISDIR', 'EROFS', 'ENOSPC', 'EACCES', 'EPERM'].includes(code)
            ? 'filesystem'
            : error instanceof Error && error.name === 'ValidationError'
              ? 'validation'
              : lifecycle.failureCategory;
        lifecycle.fail(category, false);
        console.error(error);
        await lifecycle.telemetry.shutdown();
        process.exitCode = 1;
    })
    .finally(() => {
        if (!lifecycle.interrupted) {
            lifecycle.exit(Number(process.exitCode ?? 0));
        }
    });
