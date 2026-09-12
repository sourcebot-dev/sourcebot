import {
    confirm as rawConfirm,
    input as rawInput,
    password as rawPassword,
    select as rawSelect,
} from '@inquirer/prompts';
import { select as rawSearchSelect } from 'inquirer-select-pro';
import { tabCheckbox } from './tabCheckbox.js';
import { lifecycle } from './lifecycle.js';

// Preserve the library's generic call signatures, including multi-select return types.
function cancellable<T>(prompt: T): T {
    return (async (config: unknown, context: Record<string, unknown> = {}) => {
        lifecycle.check();
        try {
            const result = await (
                prompt as (
                    config: unknown,
                    context: unknown,
                ) => Promise<unknown>
            )(config, { ...context, signal: lifecycle.signal });
            lifecycle.check();
            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'ExitPromptError') {
                lifecycle.interrupt();
            }
            throw error;
        }
    }) as T;
}
export const confirm = cancellable(rawConfirm);
export const input = cancellable(rawInput);
export const password = cancellable(rawPassword);
export const select = cancellable(rawSelect);
export const searchSelect = cancellable(rawSearchSelect);
export const checkbox = cancellable(tabCheckbox);
