import { checkbox, input, password } from '@inquirer/prompts';
import type { GiteaConnectionConfig } from '@sourcebot/schemas/v3/gitea.type';
import type { CollectResult, EnvVars } from './utils.js';
import { multiInput, toEnvKey } from './utils.js';

export async function collectGiteaConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};
    const config: GiteaConnectionConfig = { type: 'gitea' };

    const url = await input({
        message: 'Gitea URL',
        default: 'https://gitea.com',
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
    if (url !== 'https://gitea.com') {
        config.url = url;
    }

    const giteaEnvKey = toEnvKey(connectionName, 'TOKEN');
    const giteaToken = await password({
        message: `Gitea Access Token (stored as ${giteaEnvKey}, leave blank for public repos only)`,
        mask: true,
    });
    if (giteaToken.trim()) {
        env[giteaEnvKey] = giteaToken;
        config.token = { env: giteaEnvKey };
    }

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'orgs', name: 'Organizations' },
            { value: 'repos', name: 'Specific repositories', description: 'owner/repo format' },
            { value: 'users', name: 'Users' },
        ],
        required: true,
    });

    if (targets.includes('orgs')) {
        config.orgs = await multiInput({
            message: 'Organizations to index',
        });
    }

    if (targets.includes('repos')) {
        config.repos = await multiInput({
            message: 'Repositories to index (owner/repo)',
        });
    }

    if (targets.includes('users')) {
        config.users = await multiInput({
            message: 'Users to index',
        });
    }

    return { connections: [{ config }], env };
}
