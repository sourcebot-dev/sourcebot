import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    env: {
        SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED: 'false',
    },
    getTokenFromConfig: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => mocks);
vi.mock('server-only', () => ({}));

import {
    resolveLanguageModelHeaders,
    SOURCEBOT_USER_EMAIL_HEADER,
} from './languageModelHeaders.server';

describe('resolveLanguageModelHeaders', () => {
    beforeEach(() => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'false';
        mocks.getTokenFromConfig.mockReset();
    });

    test('does not add the user email header by default', async () => {
        await expect(resolveLanguageModelHeaders(undefined, 'User@Example.com')).resolves.toBeUndefined();
    });

    test('adds a lower-cased user email when enabled', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveLanguageModelHeaders(undefined, 'User@Example.COM')).resolves.toEqual({
            [SOURCEBOT_USER_EMAIL_HEADER]: 'user@example.com',
        });
    });

    test('omits the user email header for anonymous requests', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveLanguageModelHeaders(undefined, undefined)).resolves.toBeUndefined();
    });

    test('preserves configured headers and overrides a case-insensitive email header', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveLanguageModelHeaders({
            'x-sourcebot-user-email': 'configured@example.com',
            'X-Custom-Header': 'custom-value',
        }, 'Authenticated@Example.com')).resolves.toEqual({
            'X-Custom-Header': 'custom-value',
            [SOURCEBOT_USER_EMAIL_HEADER]: 'authenticated@example.com',
        });
    });

    test('resolves token-backed configured headers', async () => {
        const token = { env: 'CUSTOM_HEADER' };
        mocks.getTokenFromConfig.mockResolvedValue('resolved-value');

        await expect(resolveLanguageModelHeaders({ Authorization: token }, undefined)).resolves.toEqual({
            Authorization: 'resolved-value',
        });
        expect(mocks.getTokenFromConfig).toHaveBeenCalledWith(token);
    });
});
