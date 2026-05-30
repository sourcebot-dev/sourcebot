import chalk from 'chalk';
import { randomBytes } from 'crypto';
import { select as searchSelect } from 'inquirer-select-pro';
import type { ConnectionConfig } from '@sourcebot/schemas/v3/index.type';

export type { ConnectionConfig };
export type EnvVars = Record<string, string>;
export type CollectResult = {
    /**
     * One or more connections produced by the host's collect function. Single-connection
     * hosts return a single entry with no `name` (main() uses the platform-derived
     * connection name). Multi-connection hosts provide a `name` per entry.
     */
    connections: Array<{ name?: string; config: ConnectionConfig }>;
    env: EnvVars;
    /**
     * Optional host path that needs to be mounted into the Sourcebot container.
     * Surfaced in the wizard's next-steps so users get the matching volume mount line.
     */
    localRepoHostPath?: string;
};

export const INPUT_THEME = {
    style: {
        defaultAnswer: (text: string) => chalk.dim(`(default: ${text})`),
    },
};

// Per-prompt theme + filter tracker for `searchSelect` / `multiInput` callers.
// The theme:
//   - Renders selections as `a, b, c,` (with trailing comma) so the prompt
//     visually invites adding more entries on the same line.
//   - Suppresses the empty-results message when the filter is empty, so
//     "No results" only appears once the user has actually typed something
//     that returned zero matches.
// Each prompt should get its own context so the closure-captured `lastSearch`
// doesn't bleed between prompts.
export function createSearchSelectContext() {
    let lastSearch = '';
    let isLoading = false;
    return {
        trackSearch: (search: string | undefined): void => {
            lastSearch = search ?? '';
        },
        setLoading: (loading: boolean): void => {
            isLoading = loading;
        },
        theme: {
            style: {
                renderSelectedOptions: <T>(
                    selectedOptions: ReadonlyArray<{ focused?: boolean; name?: string; value: T }>,
                ): string => {
                    if (selectedOptions.length === 0) {
                        return '';
                    }
                    const items = selectedOptions.map((option) =>
                        option.focused
                            ? chalk.inverse(option.name || String(option.value))
                            : (option.name || String(option.value))
                    );
                    return items.join(', ') + ',';
                },
                emptyText: (text: string) =>
                    (lastSearch && !isLoading) ? `${chalk.blue('ℹ')} ${chalk.bold(text)}` : '',
            },
        },
    };
}

export function generateSecret(bytes: number): string {
    return randomBytes(bytes).toString('base64');
}

export function toEnvKey(connectionName: string, suffix: string): string {
    return `${connectionName.toUpperCase().replace(/-/g, '_')}_${suffix}`;
}

export function generateConnectionName(platform: string, existing: Record<string, unknown>): string {
    if (!existing[platform]) {
        return platform;
    }
    let i = 1;
    while (existing[`${platform}-${i}`]) {
        i++;
    }
    return `${platform}-${i}`;
}

export async function multiInput(options: {
    message: string;
    placeholder?: string;
    validate?: (value: string) => string | true;
}): Promise<string[]> {
    const ctx = createSearchSelectContext();
    return searchSelect<string, true>({
        message: options.message,
        multiple: true,
        required: true,
        loop: false,
        clearInputWhenSelected: true,
        theme: ctx.theme,
        placeholder: options.placeholder ?? 'Type a value and press tab to add, enter to finish',
        options: async (search) => {
            ctx.trackSearch(search);
            if (!search) {
                return [];
            }
            return [{ name: search, value: search }];
        },
        validate: options.validate
            ? (selected) => {
                for (const opt of selected) {
                    const result = options.validate!(opt.value);
                    if (result !== true) {
                        return result;
                    }
                }
                return true;
            }
            : undefined,
    });
}

export function note(message: string, title?: string): void {
    console.log();
    if (title) {
        console.log(chalk.cyan('◆ ') + chalk.bold(title));
    }
    for (const line of message.split('\n')) {
        console.log(chalk.gray('│ ') + line);
    }
    console.log();
}
