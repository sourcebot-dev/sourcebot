import { checkbox, password } from '@inquirer/prompts';
import type { AzureDevOpsConnectionConfig } from '@sourcebot/schemas/v3/azuredevops.type';
import type { CollectResult, EnvVars } from './utils.js';
import { multiInput, toEnvKey } from './utils.js';

export async function collectAzureDevOpsConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};

    const envKey = toEnvKey(connectionName, 'TOKEN');
    const token = await password({
        message: `Azure DevOps Personal Access Token (stored as ${envKey})`,
        mask: true,
        validate: (v) => !v?.trim() ? 'Token is required' : true,
    });
    env[envKey] = token;

    const config: AzureDevOpsConnectionConfig = {
        type: 'azuredevops',
        deploymentType: 'cloud',
        token: { env: envKey },
    };

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'orgs', name: 'Organizations', description: 'all projects in an org' },
            { value: 'projects', name: 'Specific projects', description: 'org/project format' },
            { value: 'repos', name: 'Specific repositories', description: 'org/project/repo format' },
        ],
        required: true,
    });

    if (targets.includes('orgs')) {
        config.orgs = await multiInput({
            message: 'Organizations to index',
        });
    }

    if (targets.includes('projects')) {
        config.projects = await multiInput({
            message: 'Projects to index (org/project)',
        });
    }

    if (targets.includes('repos')) {
        config.repos = await multiInput({
            message: 'Repositories to index (org/project/repo)',
        });
    }

    return { connections: [{ config }], env };
}
