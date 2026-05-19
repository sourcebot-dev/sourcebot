#!/usr/bin/env node
import {
    cancel,
    confirm,
    intro,
    isCancel,
    multiselect,
    note,
    outro,
    password,
    select,
    spinner,
    text,
} from '@clack/prompts';
import { randomBytes } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import { writeFile } from 'fs/promises';

// @nocheckin: change this to main
const DOCKER_COMPOSE_BRANCH = 'bkellam/setup-wizard'
const DOCKER_COMPOSE_URL = `https://raw.githubusercontent.com/sourcebot-dev/sourcebot/${DOCKER_COMPOSE_BRANCH}/docker-compose.yml`;

type ConnectionConfig = Record<string, unknown>;
type EnvVars = Record<string, string>;
type CollectResult = { config: ConnectionConfig; env: EnvVars };

function generateSecret(bytes: number): string {
    return randomBytes(bytes).toString('base64');
}

function checkCancel<T>(value: T | symbol): T {
    if (isCancel(value)) {
        cancel('Setup cancelled.');
        process.exit(0);
    }
    return value as T;
}

function parseCommaSeparated(input: string): string[] {
    return input.split(',').map(s => s.trim()).filter(Boolean);
}

function toEnvKey(connectionName: string, suffix: string): string {
    return `${connectionName.toUpperCase().replace(/-/g, '_')}_${suffix}`;
}

function generateConnectionName(platform: string, existing: Record<string, unknown>): string {
    if (!existing[platform]) {
        return platform;
    }
    let i = 1;
    while (existing[`${platform}-${i}`]) {
        i++;
    }
    return `${platform}-${i}`;
}

async function collectGitHubConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: ConnectionConfig = { type: 'github' };

    const url = checkCancel(await text({
        message: 'GitHub URL',
        initialValue: 'https://github.com',
        validate: v => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
        },
    })) as string;
    if (url !== 'https://github.com') {
        config.url = url;
    }

    note(
        [
            'Fine-grained PAT (recommended):',
            `  ${url}/settings/personal-access-tokens/new`,
            '  Required permissions: Contents (read), Metadata (read)',
            '',
            'Classic PAT:',
            `  ${url}/settings/tokens/new`,
            '  Required scope: repo',
        ].join('\n'),
        'Create a GitHub Personal Access Token'
    );

    const envKey = toEnvKey(connectionName, 'TOKEN');
    const token = checkCancel(await password({
        message: `GitHub Personal Access Token (stored as ${envKey}, leave blank for public repos only)`,
    }));
    if ((token as string | undefined)?.trim()) {
        env[envKey] = token as string;
        config.token = { env: envKey };
    }

    const targets = checkCancel(await multiselect({
        message: 'What do you want to index?',
        options: [
            { value: 'repos', label: 'Specific repositories', hint: 'e.g. org/repo' },
            { value: 'orgs', label: 'Organizations', hint: 'all repos in an org' },
            { value: 'users', label: 'Users', hint: 'all repos owned by a user' },
        ],
        required: true,
    })) as string[];

    if (targets.includes('repos')) {
        const input = checkCancel(await text({
            message: 'Repositories (comma-separated, owner/repo)',
            placeholder: 'sourcebot-dev/sourcebot, torvalds/linux',
            validate: v => {
                if (!v?.trim()) {
                    return 'At least one repository is required';
                }
                for (const r of parseCommaSeparated(v)) {
                    if (!/^[\w.-]+\/[\w.-]+$/.test(r)) {
                        return `Invalid format: "${r}" — expected owner/repo`;
                    }
                }
            },
        }));
        config.repos = parseCommaSeparated(input as string);
    }

    if (targets.includes('orgs')) {
        const input = checkCancel(await text({
            message: 'Organizations (comma-separated)',
            placeholder: 'my-org, another-org',
            validate: v => !v?.trim() ? 'At least one organization is required' : undefined,
        }));
        config.orgs = parseCommaSeparated(input as string);
    }

    if (targets.includes('users')) {
        const input = checkCancel(await text({
            message: 'GitHub users (comma-separated)',
            placeholder: 'torvalds, DHH',
            validate: v => !v?.trim() ? 'At least one user is required' : undefined,
        }));
        config.users = parseCommaSeparated(input as string);
    }

    return { config, env };
}

async function collectGitLabConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: ConnectionConfig = { type: 'gitlab' };

    const url = checkCancel(await text({
        message: 'GitLab URL',
        initialValue: 'https://gitlab.com',
        validate: v => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
        },
    })) as string;
    if (url !== 'https://gitlab.com') {
        config.url = url;
    }

    const gitlabEnvKey = toEnvKey(connectionName, 'TOKEN');
    const gitlabToken = checkCancel(await password({
        message: `GitLab Personal Access Token (stored as ${gitlabEnvKey}, leave blank for public repos only)`,
    }));
    if ((gitlabToken as string | undefined)?.trim()) {
        env[gitlabEnvKey] = gitlabToken as string;
        config.token = { env: gitlabEnvKey };
    }

    const targets = checkCancel(await multiselect({
        message: 'What do you want to index?',
        options: [
            { value: 'groups', label: 'Groups', hint: 'all projects in a group' },
            { value: 'projects', label: 'Specific projects', hint: 'e.g. group/project' },
            { value: 'users', label: 'Users', hint: 'all projects owned by a user' },
        ],
        required: true,
    })) as string[];

    if (targets.includes('groups')) {
        const input = checkCancel(await text({
            message: 'Groups (comma-separated)',
            placeholder: 'my-group, another-group',
            validate: v => !v?.trim() ? 'At least one group is required' : undefined,
        }));
        config.groups = parseCommaSeparated(input as string);
    }

    if (targets.includes('projects')) {
        const input = checkCancel(await text({
            message: 'Projects (comma-separated, group/project)',
            placeholder: 'my-group/my-project',
            validate: v => !v?.trim() ? 'At least one project is required' : undefined,
        }));
        config.projects = parseCommaSeparated(input as string);
    }

    if (targets.includes('users')) {
        const input = checkCancel(await text({
            message: 'Users (comma-separated)',
            placeholder: 'john.doe, jane.smith',
            validate: v => !v?.trim() ? 'At least one user is required' : undefined,
        }));
        config.users = parseCommaSeparated(input as string);
    }

    return { config, env };
}

async function collectBitbucketConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: ConnectionConfig = { type: 'bitbucket' };

    const userEnvKey = toEnvKey(connectionName, 'USERNAME');
    const username = checkCancel(await text({
        message: `Bitbucket username (stored as ${userEnvKey})`,
        placeholder: 'your-username',
        validate: v => !v?.trim() ? 'Username is required' : undefined,
    }));
    env[userEnvKey] = username as string;
    config.user = { env: userEnvKey };

    const tokenEnvKey = toEnvKey(connectionName, 'APP_PASSWORD');
    const token = checkCancel(await password({
        message: `Bitbucket App Password (stored as ${tokenEnvKey})`,
        validate: v => !v?.trim() ? 'App Password is required' : undefined,
    }));
    env[tokenEnvKey] = token as string;
    config.token = { env: tokenEnvKey };

    const targets = checkCancel(await multiselect({
        message: 'What do you want to index?',
        options: [
            { value: 'workspaces', label: 'Workspaces', hint: 'all repos in a workspace' },
            { value: 'repos', label: 'Specific repositories', hint: 'workspace/repo format' },
        ],
        required: true,
    })) as string[];

    if (targets.includes('workspaces')) {
        const input = checkCancel(await text({
            message: 'Workspaces (comma-separated)',
            placeholder: 'my-workspace',
            validate: v => !v?.trim() ? 'At least one workspace is required' : undefined,
        }));
        config.workspaces = parseCommaSeparated(input as string);
    }

    if (targets.includes('repos')) {
        const input = checkCancel(await text({
            message: 'Repositories (comma-separated, workspace/repo)',
            placeholder: 'my-workspace/my-repo',
            validate: v => !v?.trim() ? 'At least one repository is required' : undefined,
        }));
        config.repos = parseCommaSeparated(input as string);
    }

    return { config, env };
}

async function collectGiteaConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: ConnectionConfig = { type: 'gitea' };

    const url = checkCancel(await text({
        message: 'Gitea URL',
        initialValue: 'https://gitea.com',
        validate: v => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
        },
    })) as string;
    if (url !== 'https://gitea.com') {
        config.url = url;
    }

    const giteaEnvKey = toEnvKey(connectionName, 'TOKEN');
    const giteaToken = checkCancel(await password({
        message: `Gitea Access Token (stored as ${giteaEnvKey}, leave blank for public repos only)`,
    }));
    if ((giteaToken as string | undefined)?.trim()) {
        env[giteaEnvKey] = giteaToken as string;
        config.token = { env: giteaEnvKey };
    }

    const targets = checkCancel(await multiselect({
        message: 'What do you want to index?',
        options: [
            { value: 'orgs', label: 'Organizations' },
            { value: 'repos', label: 'Specific repositories', hint: 'owner/repo format' },
            { value: 'users', label: 'Users' },
        ],
        required: true,
    })) as string[];

    if (targets.includes('orgs')) {
        const input = checkCancel(await text({
            message: 'Organizations (comma-separated)',
            placeholder: 'my-org',
            validate: v => !v?.trim() ? 'At least one organization is required' : undefined,
        }));
        config.orgs = parseCommaSeparated(input as string);
    }

    if (targets.includes('repos')) {
        const input = checkCancel(await text({
            message: 'Repositories (comma-separated, owner/repo)',
            placeholder: 'owner/repo',
            validate: v => !v?.trim() ? 'At least one repository is required' : undefined,
        }));
        config.repos = parseCommaSeparated(input as string);
    }

    if (targets.includes('users')) {
        const input = checkCancel(await text({
            message: 'Users (comma-separated)',
            placeholder: 'username',
            validate: v => !v?.trim() ? 'At least one user is required' : undefined,
        }));
        config.users = parseCommaSeparated(input as string);
    }

    return { config, env };
}

async function collectAzureDevOpsConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: ConnectionConfig = { type: 'azuredevops' };

    const envKey = toEnvKey(connectionName, 'TOKEN');
    const token = checkCancel(await password({
        message: `Azure DevOps Personal Access Token (stored as ${envKey})`,
        validate: v => !v?.trim() ? 'Token is required' : undefined,
    }));
    env[envKey] = token as string;
    config.token = { env: envKey };

    const targets = checkCancel(await multiselect({
        message: 'What do you want to index?',
        options: [
            { value: 'orgs', label: 'Organizations', hint: 'all projects in an org' },
            { value: 'projects', label: 'Specific projects', hint: 'org/project format' },
            { value: 'repos', label: 'Specific repositories', hint: 'org/project/repo format' },
        ],
        required: true,
    })) as string[];

    if (targets.includes('orgs')) {
        const input = checkCancel(await text({
            message: 'Organizations (comma-separated)',
            placeholder: 'my-org',
            validate: v => !v?.trim() ? 'At least one organization is required' : undefined,
        }));
        config.orgs = parseCommaSeparated(input as string);
    }

    if (targets.includes('projects')) {
        const input = checkCancel(await text({
            message: 'Projects (comma-separated, org/project)',
            placeholder: 'my-org/my-project',
            validate: v => !v?.trim() ? 'At least one project is required' : undefined,
        }));
        config.projects = parseCommaSeparated(input as string);
    }

    if (targets.includes('repos')) {
        const input = checkCancel(await text({
            message: 'Repositories (comma-separated, org/project/repo)',
            placeholder: 'my-org/my-project/my-repo',
            validate: v => !v?.trim() ? 'At least one repository is required' : undefined,
        }));
        config.repos = parseCommaSeparated(input as string);
    }

    return { config, env };
}

async function collectGerritConfig(): Promise<CollectResult> {
    const config: ConnectionConfig = { type: 'gerrit' };

    const url = checkCancel(await text({
        message: 'Gerrit URL',
        placeholder: 'https://gerrit.example.com',
        validate: v => {
            if (!v?.trim()) {
                return 'URL is required';
            }
            if (!/^https?:\/\//.test(v)) {
                return 'Must start with http:// or https://';
            }
        },
    }));
    config.url = url;

    const indexAll = checkCancel(await confirm({
        message: 'Index all projects?',
        initialValue: true,
    }));

    if (!indexAll) {
        const input = checkCancel(await text({
            message: 'Projects to index (comma-separated)',
            placeholder: 'my-project, another-project',
            validate: v => !v?.trim() ? 'At least one project is required' : undefined,
        }));
        config.projects = parseCommaSeparated(input as string);
    }

    return { config, env: {} };
}

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

    const wantsAI = checkCancel(await confirm({
        message: 'Would you like to configure AI features?',
        initialValue: true,
    }));

    if (!wantsAI) {
        return { models, env };
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const provider = checkCancel(await select({
            message: 'Which AI provider?',
            options: [
                { value: 'anthropic', label: 'Anthropic', hint: 'Claude' },
                { value: 'openai', label: 'OpenAI', hint: 'GPT-4o, o1' },
                { value: 'google-generative-ai', label: 'Google Gemini' },
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'mistral', label: 'Mistral' },
                { value: 'xai', label: 'xAI', hint: 'Grok' },
                { value: 'openrouter', label: 'OpenRouter' },
                { value: 'openai-compatible', label: 'OpenAI-compatible', hint: 'self-hosted / custom endpoint' },
                { value: 'amazon-bedrock', label: 'Amazon Bedrock' },
                { value: 'azure', label: 'Azure OpenAI' },
            ],
        })) as string;

        const modelConfig: ModelConfig = { provider };

        const defaultModel = PROVIDER_DEFAULT_MODELS[provider];
        const model = checkCancel(await text({
            message: 'Model name',
            initialValue: defaultModel ?? '',
            placeholder: defaultModel ? undefined : 'model-name',
            validate: v => !v?.trim() ? 'Model name is required' : undefined,
        }));
        modelConfig.model = model;

        if (provider === 'openai-compatible') {
            const baseUrl = checkCancel(await text({
                message: 'Base URL',
                placeholder: 'https://your-endpoint.example.com/v1',
                validate: v => {
                    if (!v?.trim()) {
                        return 'Base URL is required';
                    }
                    if (!/^https?:\/\//.test(v)) {
                        return 'Must start with http:// or https://';
                    }
                },
            }));
            modelConfig.baseUrl = baseUrl;
        }

        if (provider === 'azure') {
            const resourceName = checkCancel(await text({
                message: 'Azure resource name',
                placeholder: 'my-azure-resource',
                validate: v => !v?.trim() ? 'Resource name is required' : undefined,
            }));
            modelConfig.resourceName = resourceName;

            const apiVersion = checkCancel(await text({
                message: 'API version',
                initialValue: '2024-08-01-preview',
                validate: v => !v?.trim() ? 'API version is required' : undefined,
            }));
            modelConfig.apiVersion = apiVersion;
        }

        if (provider === 'amazon-bedrock') {
            const useDefaultChain = checkCancel(await confirm({
                message: 'Use the default AWS credential chain? (No to provide Access Key ID and Secret explicitly)',
                initialValue: true,
            }));

            if (!useDefaultChain) {
                if (!env['AWS_ACCESS_KEY_ID']) {
                    const keyId = checkCancel(await text({
                        message: 'AWS Access Key ID (stored as AWS_ACCESS_KEY_ID)',
                        validate: v => !v?.trim() ? 'Access Key ID is required' : undefined,
                    }));
                    env['AWS_ACCESS_KEY_ID'] = keyId as string;
                }
                modelConfig.accessKeyId = { env: 'AWS_ACCESS_KEY_ID' };

                if (!env['AWS_SECRET_ACCESS_KEY']) {
                    const secret = checkCancel(await password({
                        message: 'AWS Secret Access Key (stored as AWS_SECRET_ACCESS_KEY)',
                        validate: v => !v?.trim() ? 'Secret Access Key is required' : undefined,
                    }));
                    env['AWS_SECRET_ACCESS_KEY'] = secret as string;
                }
                modelConfig.accessKeySecret = { env: 'AWS_SECRET_ACCESS_KEY' };
            }

            const region = checkCancel(await text({
                message: 'AWS region',
                initialValue: 'us-east-1',
                validate: v => !v?.trim() ? 'Region is required' : undefined,
            }));
            modelConfig.region = region;
        } else {
            const envKey = PROVIDER_ENV_KEYS[provider] ?? `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
            if (!env[envKey]) {
                const apiKey = checkCancel(await password({
                    message: `API key (stored as ${envKey})`,
                    validate: v => !v?.trim() ? 'API key is required' : undefined,
                }));
                env[envKey] = apiKey as string;
            }
            modelConfig.token = { env: envKey };
        }

        models.push(modelConfig);

        const addAnother = checkCancel(await confirm({
            message: 'Add another model?',
            initialValue: false,
        }));

        if (!addAnother) {
            break;
        }
    }

    return { models, env };
}

const PLATFORM_LABELS: Record<string, string> = {
    github: 'GitHub',
    gitlab: 'GitLab',
    bitbucket: 'Bitbucket Cloud',
    gitea: 'Gitea',
    azuredevops: 'Azure DevOps',
    gerrit: 'Gerrit',
};

async function main() {
    intro('Create Sourcebot Configuration');

    const connections: Record<string, ConnectionConfig> = {};
    const allEnv: EnvVars = {};

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const platform = checkCancel(await select({
            message: 'Which platform do you want to connect?',
            options: [
                { value: 'github', label: 'GitHub', hint: 'github.com or GitHub Enterprise' },
                { value: 'gitlab', label: 'GitLab', hint: 'gitlab.com or self-hosted' },
                { value: 'bitbucket', label: 'Bitbucket Cloud', hint: 'bitbucket.org' },
                { value: 'gitea', label: 'Gitea', hint: 'self-hosted Gitea' },
                { value: 'azuredevops', label: 'Azure DevOps', hint: 'dev.azure.com' },
                { value: 'gerrit', label: 'Gerrit', hint: 'self-hosted Gerrit' },
            ],
        })) as string;

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
            default:
                continue;
        }

        connections[connectionName] = result.config;
        Object.assign(allEnv, result.env);

        const addAnother = checkCancel(await confirm({
            message: 'Add another connection?',
            initialValue: false,
        }));

        if (!addAnother) {
            break;
        }
    }

    const { models, env: modelEnv } = await collectModels();
    Object.assign(allEnv, modelEnv);

    if (existsSync('config.json')) {
        const overwrite = checkCancel(await confirm({
            message: 'config.json already exists. Overwrite?',
            initialValue: false,
        }));
        if (!overwrite) {
            cancel('config.json was not overwritten.');
            process.exit(0);
        }
    }

    const s = spinner();
    s.start('Writing configuration files...');

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
        '# Generated by create-sourcebot',
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

    const envPath = existsSync('.env') ? '.env.sourcebot' : '.env';
    writeFileSync(envPath, envLines.join('\n') + '\n');

    s.stop(`Wrote config.json and ${envPath}`);

    let downloadedCompose = false;

    if (!existsSync('docker-compose.yml')) {
        const download = checkCancel(await confirm({
            message: 'Download docker-compose.yml?',
            initialValue: true,
        }));

        if (download) {
            const ds = spinner();
            ds.start('Downloading docker-compose.yml...');
            try {
                const res = await fetch(DOCKER_COMPOSE_URL);
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }
                await writeFile('docker-compose.yml', await res.text());
                ds.stop('Downloaded docker-compose.yml');
                downloadedCompose = true;
            } catch {
                ds.stop('Download failed — you can get it manually (see next steps)');
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

    if (envPath === '.env.sourcebot') {
        nextSteps.push(`${step++}. Rename ${envPath} to .env:`);
        nextSteps.push(`   mv ${envPath} .env`);
        nextSteps.push('');
    }

    nextSteps.push(`${step++}. Start Sourcebot:`);
    nextSteps.push('   docker compose up');
    nextSteps.push('');
    nextSteps.push(`${step}. Open http://localhost:3000`);

    note(nextSteps.join('\n'), 'Next steps');

    outro('Your Sourcebot configuration is ready!');
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
