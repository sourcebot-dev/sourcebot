import { checkbox, confirm, input, password, select } from '@inquirer/prompts';
import type { AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/azuredevops.type';
import type { CollectResult, EnvVars } from './utils.js';
import { multiInput, note, toEnvKey } from './utils.js';

export async function collectAzureDevOpsConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};

    const deploymentType = await select<'cloud' | 'server'>({
        message: 'Which Azure DevOps deployment?',
        choices: [
            { value: 'cloud', name: 'Azure DevOps Cloud', description: 'dev.azure.com' },
            { value: 'server', name: 'Azure DevOps Server', description: 'self-hosted' },
        ],
    });

    const config: AzureDevOpsConnectionConfig = {
        type: 'azuredevops',
        deploymentType,
        token: { env: '' },
    };

    if (deploymentType === 'server') {
        const url = await input({
            message: 'Azure DevOps Server URL (e.g. https://ado.example.com)',
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
        config.url = url;

        const useTfsPath = await confirm({
            message: 'Use legacy TFS path format (/tfs in API URLs)?',
            default: false,
        });
        if (useTfsPath) {
            config.useTfsPath = true;
        }
    }

    note(
        [
            'Create a Personal Access Token at:',
            deploymentType === 'cloud'
                ? '  https://dev.azure.com/<your-org>/_usersSettings/tokens'
                : '  <your-server-url>/_usersSettings/tokens',
            'Grant `Code (Read)` scope so Sourcebot can find and clone your repos.',
        ].join('\n'),
        'Azure DevOps Personal Access Token',
    );

    const envKey = toEnvKey(connectionName, 'TOKEN');
    const token = await password({
        message: `Azure DevOps Personal Access Token (stored as ${envKey})`,
        mask: true,
        validate: (v) => !v?.trim() ? 'Token is required' : true,
    });
    env[envKey] = token;
    config.token = { env: envKey };

    const orgLabel = deploymentType === 'cloud' ? 'organization' : 'collection';
    const orgLabelPlural = deploymentType === 'cloud' ? 'Organizations' : 'Collections';

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'orgs', name: orgLabelPlural, description: `all projects in a ${orgLabel}` },
            { value: 'projects', name: 'Specific projects', description: `${orgLabel}/project format` },
            { value: 'repos', name: 'Specific repositories', description: `${orgLabel}/project/repo format` },
        ],
        required: true,
    });

    if (targets.includes('orgs')) {
        config.orgs = await multiInput({
            message: `${orgLabelPlural} to index`,
        });
    }

    if (targets.includes('projects')) {
        config.projects = await multiInput({
            message: `Projects to index (${orgLabel}/project)`,
        });
    }

    if (targets.includes('repos')) {
        config.repos = await multiInput({
            message: `Repositories to index (${orgLabel}/project/repo)`,
        });
    }

    return { connections: [{ config }], env };
}
