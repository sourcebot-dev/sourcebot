import { confirm, input } from '@inquirer/prompts';
import type { GerritConnectionConfig } from '@sourcebot/schemas/v3/gerrit.type';
import type { CollectResult } from './utils.js';
import { multiInput } from './utils.js';

export async function collectGerritConfig(): Promise<CollectResult> {
    const url = await input({
        message: 'Gerrit URL (e.g. https://gerrit.example.com)',
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

    const config: GerritConnectionConfig = {
        type: 'gerrit',
        url,
    };

    const indexAll = await confirm({
        message: 'Index all projects?',
        default: true,
    });

    if (!indexAll) {
        config.projects = await multiInput({
            message: 'Projects to index',
        });
    }

    return { connections: [{ config }], env: {} };
}
