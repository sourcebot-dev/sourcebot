#!/usr/bin/env node
import { confirm, input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { basename } from 'path';
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

function openBrowser(url: string): void {
    const cmd = process.platform === 'darwin' ? 'open'
        : process.platform === 'win32' ? 'cmd'
            : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '""', url] : [url];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
}

async function openBrowserWhenReady(url: string, timeoutMs = 120_000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
            if (res.status < 500) {
                openBrowser(url);
                return;
            }
        } catch {
            // not yet ready
        }
        await new Promise((r) => setTimeout(r, 2000));
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

// Mirrors Docker Compose's project-name normalization for the default case
// where the project name is derived from the working directory basename.
function dockerComposeProjectName(): string {
    return basename(process.cwd())
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');
}

async function listExistingDockerVolumes(expectedNames: string[]): Promise<string[]> {
    if (expectedNames.length === 0) {
        return [];
    }
    return new Promise<string[]>((resolve) => {
        const child = spawn('docker', ['volume', 'ls', '--format', '{{.Name}}'], {
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        let out = '';
        child.stdout?.on('data', (chunk: Buffer) => {
            out += chunk.toString();
        });
        child.on('exit', (code) => {
            if (code !== 0) {
                resolve([]);
                return;
            }
            const existing = new Set(out.split('\n').map((l) => l.trim()).filter(Boolean));
            resolve(expectedNames.filter((name) => existing.has(name)));
        });
        child.on('error', () => resolve([]));
    });
}

async function removeDockerVolumes(volumes: string[]): Promise<boolean> {
    if (volumes.length === 0) {
        return true;
    }
    return new Promise<boolean>((resolve) => {
        const child = spawn('docker', ['volume', 'rm', ...volumes], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr?.on('data', (chunk: Buffer) => {
            err += chunk.toString();
        });
        child.on('exit', (code) => {
            if (code !== 0 && err.trim()) {
                console.error(chalk.red('✗ ') + err.trim());
            }
            resolve(code === 0);
        });
        child.on('error', () => resolve(false));
    });
}

type ComposeContainer = { Name: string; Service: string; State: string };

function parseComposePsOutput(output: string): ComposeContainer[] {
    const trimmed = output.trim();
    if (!trimmed) {
        return [];
    }
    if (trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed) as ComposeContainer[];
        } catch {
            // fall through to line-based parse
        }
    }
    const containers: ComposeContainer[] = [];
    for (const line of trimmed.split('\n')) {
        if (!line.trim()) {
            continue;
        }
        try {
            containers.push(JSON.parse(line) as ComposeContainer);
        } catch {
            // skip unparseable line
        }
    }
    return containers;
}

async function listComposeContainers(): Promise<ComposeContainer[]> {
    return new Promise<ComposeContainer[]>((resolve) => {
        const child = spawn('docker', ['compose', 'ps', '-a', '--format', 'json'], {
            stdio: ['ignore', 'pipe', 'ignore'],
        });
        let out = '';
        child.stdout?.on('data', (chunk: Buffer) => {
            out += chunk.toString();
        });
        child.on('exit', (code) => {
            if (code !== 0) {
                resolve([]);
                return;
            }
            resolve(parseComposePsOutput(out));
        });
        child.on('error', () => resolve([]));
    });
}

async function runComposeCommand(args: string[], label: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        const child = spawn('docker', ['compose', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
        let err = '';
        child.stderr?.on('data', (chunk: Buffer) => {
            err += chunk.toString();
        });
        child.on('exit', (code) => {
            if (code !== 0 && err.trim()) {
                console.error(chalk.red('✗ ') + `${label}: ` + err.trim());
            }
            resolve(code === 0);
        });
        child.on('error', () => resolve(false));
    });
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

    if (existsSync(setupDir)) {
        const overwrite = await confirm({
            message: `Directory '${setupDir}' already exists. Do you want to overwrite it?`,
            default: false,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'Setup cancelled.');
            process.exit(0);
        }
    } else {
        mkdirSync(setupDir, { recursive: true });
    }

    process.chdir(setupDir);

    const connections: Record<string, ConnectionConfig> = {};
    const allEnv: EnvVars = {};
    const localRepoIndex = new Map<string, number>();

    note(
        'Code is cloned and indexed locally on this machine. No code is ever transmitted to Sourcebot.',
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const platform = await select<string>({
            message: 'Which code host do you want to connect?',
            loop: false,
            choices: [
                { value: 'github', name: 'GitHub', description: 'github.com, GitHub Enterprise Server, or GitHub Enterprise Cloud' },
                { value: 'gitlab', name: 'GitLab', description: 'gitlab.com, GitLab Self Managed, or GitLab Dedicated' },
                { value: 'local', name: 'Local git repositories', description: 'git repositories in a local directory' },
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

        for (const { name, config } of result.connections) {
            const finalName = name
                ? generateConnectionName(name, connections)
                : connectionName;
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

    const { models, env: modelEnv } = await collectModels();
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

    if (existsSync('config.json')) {
        const overwrite = await confirm({
            message: 'config.json already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'config.json was not overwritten.');
            process.exit(0);
        }
    }

    if (existsSync('.env')) {
        const overwrite = await confirm({
            message: '.env already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + '.env was not overwritten.');
            process.exit(0);
        }
    }

    if (localRepoIndex.size > 0 && existsSync('docker-compose.override.yml')) {
        const overwrite = await confirm({
            message: 'docker-compose.override.yml already exists. Overwrite?',
            default: true,
        });
        if (!overwrite) {
            console.log();
            console.log(chalk.red('✗ ') + 'docker-compose.override.yml was not overwritten.');
            process.exit(0);
        }
    }

    const s = ora('Writing configuration files...').start();

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
        Object.entries(allEnv).filter(([k]) => !Object.values(PROVIDER_ENV_KEYS).includes(k) && !['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(k) && !TOP_LEVEL_ENV_KEYS.includes(k))
    );
    const aiEnv = Object.fromEntries(
        Object.entries(allEnv).filter(([k]) => Object.values(PROVIDER_ENV_KEYS).includes(k) || ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(k))
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

    s.succeed(`Wrote ${writtenFiles.join(', ')}`);

    let downloadedCompose = false;

    if (!existsSync('docker-compose.yml')) {
        const download = await confirm({
            message: 'Download docker-compose.yml?',
            default: true,
        });

        if (download) {
            const ds = ora('Downloading docker-compose.yml...').start();
            try {
                const res = await fetch(DOCKER_COMPOSE_URL);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                await writeFile('docker-compose.yml', await res.text());
                ds.succeed('Downloaded docker-compose.yml');
                downloadedCompose = true;
            } catch {
                ds.fail('Download failed — you can get it manually (see next steps)');
            }
        }
    } else {
        downloadedCompose = true;
    }

    let leftDeploymentRunning = false;

    if (downloadedCompose) {
        const containers = await listComposeContainers();
        const running = containers.filter((c) => c.State === 'running');
        const stopped = containers.filter((c) => c.State !== 'running');

        if (running.length > 0) {
            console.log();
            console.log(chalk.yellow('⚠ ') + 'A Sourcebot deployment is already running in this project:');
            for (const c of running) {
                console.log('  ' + chalk.dim('- ') + `${c.Name} ${chalk.dim(`(${c.Service})`)}`);
            }
            const stop = await confirm({
                message: 'Stop and remove the running deployment? (required before any volume changes or restart can apply)',
                default: true,
            });
            if (stop) {
                const ds = ora('Stopping deployment...').start();
                const ok = await runComposeCommand(['down'], 'docker compose down');
                if (ok) {
                    ds.succeed('Stopped deployment');
                } else {
                    ds.fail('Failed to stop deployment');
                    leftDeploymentRunning = true;
                }
            } else {
                leftDeploymentRunning = true;
            }
        } else if (stopped.length > 0) {
            console.log();
            console.log(chalk.yellow('⚠ ') + 'Stopped containers from a previous run exist and will conflict on next start:');
            for (const c of stopped) {
                console.log('  ' + chalk.dim('- ') + `${c.Name} ${chalk.dim(`(${c.Service})`)}`);
            }
            const remove = await confirm({
                message: 'Remove them now to prevent name conflicts when Sourcebot starts?',
                default: true,
            });
            if (remove) {
                const rs = ora('Removing containers...').start();
                const ok = await runComposeCommand(['rm', '-f'], 'docker compose rm');
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
        const existing = await listExistingDockerVolumes(expectedNames);

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
            if (wipe) {
                const ws = ora('Removing volumes...').start();
                const ok = await removeDockerVolumes(existing);
                if (ok) {
                    ws.succeed(`Removed ${existing.length} volume${existing.length === 1 ? '' : 's'}`);
                } else {
                    ws.fail('Failed to remove one or more volumes (they may be in use by a running container)');
                }
            }
        }
    }

    console.log();
    console.log(chalk.green('✓ ') + chalk.bold('Your Sourcebot configuration is ready!'));

    if (downloadedCompose && !leftDeploymentRunning) {
        const startNow = await confirm({
            message: 'Start Sourcebot now? (runs `docker compose up`)',
            default: true,
        });

        if (startNow) {
            note(
                `Sourcebot will open at ${SOURCEBOT_URL} once it's ready.\nPress Ctrl+C to stop.`,
                'Starting Sourcebot',
            );
            void openBrowserWhenReady(SOURCEBOT_URL).catch(() => { /* best effort */ });
            await new Promise<void>((resolve) => {
                const child = spawn('docker', ['compose', 'up'], { stdio: 'inherit' });
                child.on('exit', () => resolve());
                child.on('error', (err) => {
                    console.error(chalk.red('✗ ') + 'Failed to run `docker compose up`: ' + (err instanceof Error ? err.message : String(err)));
                    resolve();
                });
            });
            return;
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
        return;
    }

    if (!downloadedCompose) {
        nextSteps.push(`${step++}. Download docker-compose.yml:`);
        nextSteps.push(`   curl -o docker-compose.yml ${DOCKER_COMPOSE_URL}`);
        nextSteps.push('');
    }

    nextSteps.push(`${step++}. Start Sourcebot:`);
    nextSteps.push('   docker compose up');
    nextSteps.push('');
    nextSteps.push(`${step}. Open ${SOURCEBOT_URL}`);

    note(nextSteps.join('\n'), 'Next steps');
}

main().catch(err => {
    const isExitPrompt = err instanceof Error
        && (err.name === 'ExitPromptError' || err.message?.startsWith('User force closed the prompt'));
    if (isExitPrompt) {
        console.log();
        console.log(chalk.red('✗ ') + 'Setup cancelled.');
        process.exit(0);
    }
    console.error(err);
    process.exit(1);
});
