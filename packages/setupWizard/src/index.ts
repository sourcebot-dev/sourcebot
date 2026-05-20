#!/usr/bin/env node
import { confirm, input, password, select } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { existsSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { collectAzureDevOpsConfig } from './azuredevops.js';
import { collectBitbucketConfig } from './bitbucket.js';
import { collectGenericGitConfig } from './genericGit.js';
import { collectGerritConfig } from './gerrit.js';
import { collectGiteaConfig } from './gitea.js';
import { collectGitHubConfig } from './github.js';
import { collectGitLabConfig } from './gitlab.js';
import { collectLocalReposConfig } from './localRepos.js';
import {
    type CollectResult,
    type ConnectionConfig,
    type EnvVars,
    generateConnectionName,
    generateSecret,
    note,
} from './utils.js';

// @nocheckin: change this to main
const DOCKER_COMPOSE_BRANCH = 'bkellam/setup-wizard';
const DOCKER_COMPOSE_URL = `https://raw.githubusercontent.com/sourcebot-dev/sourcebot/${DOCKER_COMPOSE_BRANCH}/docker-compose.yml`;

type ModelConfig = Record<string, unknown>;

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
    'anthropic': 'claude-sonnet-4-6',
    'openai': 'gpt-4o',
    'google-generative-ai': 'gemini-2.0-flash',
    'deepseek': 'deepseek-chat',
    'mistral': 'mistral-large-latest',
    'xai': 'grok-2-latest',
};

const PROVIDER_ENV_KEYS: Record<string, string> = {
    'anthropic': 'ANTHROPIC_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'google-generative-ai': 'GOOGLE_GENERATIVE_AI_API_KEY',
    'deepseek': 'DEEPSEEK_API_KEY',
    'mistral': 'MISTRAL_API_KEY',
    'xai': 'XAI_API_KEY',
    'openrouter': 'OPENROUTER_API_KEY',
    'openai-compatible': 'OPENAI_COMPATIBLE_API_KEY',
    'azure': 'AZURE_OPENAI_API_KEY',
};

async function collectModels(): Promise<{ models: ModelConfig[]; env: EnvVars }> {
    const models: ModelConfig[] = [];
    const env: EnvVars = {};

    const wantsAI = await confirm({
        message: 'Would you like to configure AI features?',
        default: true,
    });

    if (!wantsAI) {
        return { models, env };
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const provider = await select<string>({
            message: 'Which AI provider?',
            choices: [
                { value: 'anthropic', name: 'Anthropic', description: 'Claude' },
                { value: 'openai', name: 'OpenAI', description: 'GPT-4o, o1' },
                { value: 'google-generative-ai', name: 'Google Gemini' },
                { value: 'deepseek', name: 'DeepSeek' },
                { value: 'mistral', name: 'Mistral' },
                { value: 'xai', name: 'xAI', description: 'Grok' },
                { value: 'openrouter', name: 'OpenRouter' },
                { value: 'openai-compatible', name: 'OpenAI-compatible', description: 'self-hosted / custom endpoint' },
                { value: 'amazon-bedrock', name: 'Amazon Bedrock' },
                { value: 'azure', name: 'Azure OpenAI' },
            ],
        });

        const modelConfig: ModelConfig = { provider };

        const defaultModel = PROVIDER_DEFAULT_MODELS[provider];
        const model = await input({
            message: 'Model name',
            default: defaultModel ?? '',
            validate: (v) => !v?.trim() ? 'Model name is required' : true,
        });
        modelConfig.model = model;

        if (provider === 'openai-compatible') {
            const baseUrl = await input({
                message: 'Base URL (e.g. https://your-endpoint.example.com/v1)',
                validate: (v) => {
                    if (!v?.trim()) {
                        return 'Base URL is required';
                    }
                    if (!/^https?:\/\//.test(v)) {
                        return 'Must start with http:// or https://';
                    }
                    return true;
                },
            });
            modelConfig.baseUrl = baseUrl;
        }

        if (provider === 'azure') {
            const resourceName = await input({
                message: 'Azure resource name',
                validate: (v) => !v?.trim() ? 'Resource name is required' : true,
            });
            modelConfig.resourceName = resourceName;

            const apiVersion = await input({
                message: 'API version',
                default: '2024-08-01-preview',
                validate: (v) => !v?.trim() ? 'API version is required' : true,
            });
            modelConfig.apiVersion = apiVersion;
        }

        if (provider === 'amazon-bedrock') {
            const useDefaultChain = await confirm({
                message: 'Use the default AWS credential chain? (No to provide Access Key ID and Secret explicitly)',
                default: true,
            });

            if (!useDefaultChain) {
                if (!env['AWS_ACCESS_KEY_ID']) {
                    const keyId = await input({
                        message: 'AWS Access Key ID (stored as AWS_ACCESS_KEY_ID)',
                        validate: (v) => !v?.trim() ? 'Access Key ID is required' : true,
                    });
                    env['AWS_ACCESS_KEY_ID'] = keyId;
                }
                modelConfig.accessKeyId = { env: 'AWS_ACCESS_KEY_ID' };

                if (!env['AWS_SECRET_ACCESS_KEY']) {
                    const secret = await password({
                        message: 'AWS Secret Access Key (stored as AWS_SECRET_ACCESS_KEY)',
                        mask: true,
                        validate: (v) => !v?.trim() ? 'Secret Access Key is required' : true,
                    });
                    env['AWS_SECRET_ACCESS_KEY'] = secret;
                }
                modelConfig.accessKeySecret = { env: 'AWS_SECRET_ACCESS_KEY' };
            }

            const region = await input({
                message: 'AWS region',
                default: 'us-east-1',
                validate: (v) => !v?.trim() ? 'Region is required' : true,
            });
            modelConfig.region = region;
        } else {
            const envKey = PROVIDER_ENV_KEYS[provider] ?? `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
            if (!env[envKey]) {
                const apiKey = await password({
                    message: `API key (stored as ${envKey})`,
                    mask: true,
                    validate: (v) => !v?.trim() ? 'API key is required' : true,
                });
                env[envKey] = apiKey;
            }
            modelConfig.token = { env: envKey };
        }

        models.push(modelConfig);

        const addAnother = await confirm({
            message: 'Add another model?',
            default: false,
        });

        if (!addAnother) {
            break;
        }
    }

    return { models, env };
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

    const connections: Record<string, ConnectionConfig> = {};
    const allEnv: EnvVars = {};
    const localRepoHostPaths: string[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const platform = await select<string>({
            message: 'Which code host do you want to connect?',
            loop: false,
            choices: [
                { value: 'github', name: 'GitHub', description: 'github.com or GitHub Enterprise' },
                { value: 'gitlab', name: 'GitLab', description: 'gitlab.com or self-hosted' },
                { value: 'local', name: 'Local Git repositories', description: 'A folder of cloned repos on the host filesystem' },
                { value: 'git', name: 'Other Git host', description: 'Any git clone URL (catch-all for unsupported hosts)' },
                { value: 'azuredevops', name: 'Azure DevOps', description: 'dev.azure.com' },
                { value: 'bitbucket', name: 'Bitbucket', description: 'Cloud (bitbucket.org) or self-hosted Data Center' },
                { value: 'gitea', name: 'Gitea', description: 'self-hosted Gitea' },
                { value: 'gerrit', name: 'Gerrit', description: 'self-hosted Gerrit' },
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
                result = await collectLocalReposConfig();
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
        if (result.localRepoHostPath) {
            localRepoHostPaths.push(result.localRepoHostPath);
        }

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

    if (localRepoHostPaths.length > 0 && existsSync('docker-compose.override.yml')) {
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

    const connectionEnv = Object.fromEntries(
        Object.entries(allEnv).filter(([k]) => !Object.values(PROVIDER_ENV_KEYS).includes(k) && !['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'].includes(k))
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

    if (localRepoHostPaths.length > 0) {
        const uniquePaths = [...new Set(localRepoHostPaths)];
        const overrideYaml = [
            '# Generated by setup-sourcebot',
            '# Merged with docker-compose.yml at `docker compose up` time.',
            'services:',
            '  sourcebot:',
            '    volumes:',
            ...uniquePaths.map((p) => `      - ${p}:/repos:ro`),
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

    const nextSteps: string[] = [];
    let step = 1;

    if (!downloadedCompose) {
        nextSteps.push(`${step++}. Download docker-compose.yml:`);
        nextSteps.push(`   curl -o docker-compose.yml ${DOCKER_COMPOSE_URL}`);
        nextSteps.push('');
    }

    nextSteps.push(`${step++}. Start Sourcebot:`);
    nextSteps.push('   docker compose up');
    nextSteps.push('');
    nextSteps.push(`${step}. Open http://localhost:3000`);

    note(nextSteps.join('\n'), 'Next steps');

    console.log();
    console.log(chalk.green('✓ ') + chalk.bold('Your Sourcebot configuration is ready!'));
}

main().catch(err => {
    if (err instanceof Error && err.name === 'ExitPromptError') {
        console.log();
        console.log(chalk.red('✗ ') + 'Setup cancelled.');
        process.exit(0);
    }
    console.error(err);
    process.exit(1);
});
