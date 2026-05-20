import { checkbox, confirm, input, password, select } from '@inquirer/prompts';
import type { BitbucketConnectionConfig } from '@sourcebot/schemas/v3/bitbucket.type';
import type { CollectResult, EnvVars } from './utils.js';
import { multiInput, note, toEnvKey } from './utils.js';

export async function collectBitbucketConfig(connectionName: string): Promise<CollectResult> {
    const env: EnvVars = {};

    const deploymentType = await select<'cloud' | 'server'>({
        message: 'Which Bitbucket deployment?',
        choices: [
            { value: 'cloud', name: 'Bitbucket Cloud', description: 'bitbucket.org' },
            { value: 'server', name: 'Bitbucket Data Center', description: 'self-hosted' },
        ],
    });

    const config: BitbucketConnectionConfig = {
        type: 'bitbucket',
        deploymentType,
    };

    if (deploymentType === 'cloud') {
        return collectBitbucketCloud(connectionName, config, env);
    }
    return collectBitbucketServer(connectionName, config, env);
}

async function collectBitbucketCloud(
    connectionName: string,
    config: BitbucketConnectionConfig,
    env: EnvVars,
): Promise<CollectResult> {
    const authMethod = await select<'api-token' | 'access-token' | 'app-password'>({
        message: 'How will you authenticate?',
        choices: [
            { value: 'api-token', name: 'API Token', description: 'Recommended by Atlassian' },
            { value: 'access-token', name: 'Access Token', description: 'Scoped to a repo, project, or workspace' },
            { value: 'app-password', name: 'App Password (deprecated)', description: 'Deprecated by Atlassian' },
        ],
    });

    if (authMethod === 'api-token') {
        note(
            'The email you use to sign in to Atlassian (e.g. you@example.com).',
            'Atlassian account email',
        );

        const email = await input({
            message: 'Atlassian account email',
            validate: (v) => !v?.trim() ? 'Email is required' : true,
        });
        config.user = email;

        note(
            [
                'Your Bitbucket username (separate from your Atlassian email).',
                '  Find it at: https://bitbucket.org/account/settings/',
            ].join('\n'),
            'Bitbucket username',
        );

        const gitUser = await input({
            message: 'Bitbucket username',
            validate: (v) => !v?.trim() ? 'Username is required' : true,
        });
        config.gitUser = gitUser;

        note(
            [
                'Create an API Token at:',
                '  https://id.atlassian.com/manage-profile/security/api-tokens',
                'Click "Create API token with scopes", choose Bitbucket, and grant:',
                '  read:repository:bitbucket',
                '  read:workspace:bitbucket',
            ].join('\n'),
            'Bitbucket Cloud API Token',
        );

        const tokenEnvKey = toEnvKey(connectionName, 'TOKEN');
        const token = await password({
            message: `API Token (stored as ${tokenEnvKey})`,
            mask: true,
            validate: (v) => !v?.trim() ? 'Token is required' : true,
        });
        env[tokenEnvKey] = token;
        config.token = { env: tokenEnvKey };
    } else if (authMethod === 'access-token') {
        note(
            [
                'Create an Access Token scoped to a repo, project, or workspace.',
                '  https://support.atlassian.com/bitbucket-cloud/docs/access-tokens/',
            ].join('\n'),
            'Create a Bitbucket Cloud Access Token',
        );

        const tokenEnvKey = toEnvKey(connectionName, 'TOKEN');
        const token = await password({
            message: `Access Token (stored as ${tokenEnvKey})`,
            mask: true,
            validate: (v) => !v?.trim() ? 'Token is required' : true,
        });
        env[tokenEnvKey] = token;
        config.token = { env: tokenEnvKey };
    } else {
        note(
            [
                '⚠ App Passwords are deprecated. Prefer an API Token if possible.',
                '',
                'Create an App Password:',
                '  https://bitbucket.org/account/settings/app-passwords/new',
                '  Required permissions: Repositories (read), Workspaces (read)',
            ].join('\n'),
            'Create a Bitbucket Cloud App Password',
        );

        const username = await input({
            message: 'Bitbucket username',
            validate: (v) => !v?.trim() ? 'Username is required' : true,
        });
        config.user = username;

        const tokenEnvKey = toEnvKey(connectionName, 'APP_PASSWORD');
        const token = await password({
            message: `Bitbucket App Password (stored as ${tokenEnvKey})`,
            mask: true,
            validate: (v) => !v?.trim() ? 'App Password is required' : true,
        });
        env[tokenEnvKey] = token;
        config.token = { env: tokenEnvKey };
    }

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'workspaces', name: 'Workspaces', description: 'Index every repo each chosen workspace owns' },
            { value: 'repos', name: 'Specific repositories', description: 'Hand-pick individual repos to index' },
        ],
        required: true,
    });

    if (targets.includes('workspaces')) {
        config.workspaces = await multiInput({
            message: 'Workspaces to index',
        });
    }

    if (targets.includes('repos')) {
        config.repos = await multiInput({
            message: 'Repositories to index (workspace/repo)',
        });
    }

    return { connections: [{ config }], env };
}

async function collectBitbucketServer(
    connectionName: string,
    config: BitbucketConnectionConfig,
    env: EnvVars,
): Promise<CollectResult> {
    const url = await input({
        message: 'Bitbucket Data Center URL (e.g. https://bitbucket.example.com)',
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

    note(
        [
            'Create an HTTP Access Token:',
            '  Profile → Manage account → HTTP access tokens',
            '  Required permissions: Project read, Repository read',
            '',
            'Use a user-account token for cross-project access,',
            'or a project/repository-scoped token for narrower access.',
        ].join('\n'),
        'Create a Bitbucket Data Center HTTP Access Token',
    );

    const username = await input({
        message: 'Bitbucket username (leave blank if using a project/repo-scoped token)',
    });
    if (username.trim()) {
        config.user = username;
    }

    const tokenEnvKey = toEnvKey(connectionName, 'TOKEN');
    const token = await password({
        message: `Bitbucket HTTP Access Token (stored as ${tokenEnvKey})`,
        mask: true,
        validate: (v) => !v?.trim() ? 'Token is required' : true,
    });
    env[tokenEnvKey] = token;
    config.token = { env: tokenEnvKey };

    const indexAll = await confirm({
        message: 'Index every repository visible to the token?',
        default: false,
    });

    if (indexAll) {
        config.all = true;
        return { connections: [{ config }], env };
    }

    const targets = await checkbox<string>({
        message: 'What do you want to index?',
        choices: [
            { value: 'projects', name: 'Projects', description: 'Index every repo in each chosen project' },
            { value: 'repos', name: 'Specific repositories', description: 'Hand-pick individual repos to index' },
        ],
        required: true,
    });

    if (targets.includes('projects')) {
        config.projects = await multiInput({
            message: 'Project keys to index (e.g. MYPROJ)',
        });
    }

    if (targets.includes('repos')) {
        config.repos = await multiInput({
            message: 'Repositories to index (project/repo)',
        });
    }

    return { connections: [{ config }], env };
}
