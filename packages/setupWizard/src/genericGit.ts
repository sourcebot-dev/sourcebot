import { input } from '@inquirer/prompts';
import type { GenericGitHostConnectionConfig } from '@sourcebot/schemas/v3/genericGitHost.type';
import type { CollectResult } from './utils.js';

export async function collectGenericGitConfig(): Promise<CollectResult> {
    const url = await input({
        message: 'Git clone URL (e.g. https://github.com/sourcebot-dev/sourcebot)',
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

    const config: GenericGitHostConnectionConfig = {
        type: 'git',
        url,
    };

    return { connections: [{ config }], env: {} };
}
