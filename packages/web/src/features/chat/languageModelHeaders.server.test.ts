import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    env: {
        SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED: 'false',
    },
    getTokenFromConfig: vi.fn(),
    getAuthContext: vi.fn(),
}));

vi.mock('@sourcebot/shared', () => mocks);
vi.mock('server-only', () => ({}));
vi.mock('@/middleware/withAuth', () => ({
    getAuthContext: mocks.getAuthContext,
}));

import {
    resolveLanguageModelHeaders,
    SOURCEBOT_USER_EMAIL_HEADER,
} from './languageModelHeaders.server';

const resolveHeadersForUser = (
    email: string,
    configuredHeaders?: Parameters<typeof resolveLanguageModelHeaders>[0],
) => {
    mocks.getAuthContext.mockResolvedValue({ user: { email } });
    return resolveLanguageModelHeaders(configuredHeaders);
};

describe('resolveLanguageModelHeaders', () => {
    beforeEach(() => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'false';
        mocks.getTokenFromConfig.mockReset();
        mocks.getAuthContext.mockReset();
        mocks.getAuthContext.mockResolvedValue({ user: undefined });
    });

    test('does not add the user email header by default', async () => {
        await expect(resolveHeadersForUser('User@Example.com')).resolves.toBeUndefined();
        expect(mocks.getAuthContext).not.toHaveBeenCalled();
    });

    test('adds the current user email in lower case when enabled', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveHeadersForUser('User@Example.COM')).resolves.toEqual({
            [SOURCEBOT_USER_EMAIL_HEADER]: 'user@example.com',
        });
    });

    test('omits the user email header for anonymous requests', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveLanguageModelHeaders(undefined)).resolves.toBeUndefined();
    });

    test('omits synthetic placeholder emails', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveHeadersForUser(
            'placeholder-internal-user-id@no-email.invalid',
        )).resolves.toBeUndefined();
    });

    test('preserves configured headers and overrides a case-insensitive email header', async () => {
        mocks.env.SOURCEBOT_LLM_USER_EMAIL_HEADER_ENABLED = 'true';

        await expect(resolveHeadersForUser('Authenticated@Example.com', {
            'x-sourcebot-user-email': 'configured@example.com',
            'X-Custom-Header': 'custom-value',
        })).resolves.toEqual({
            'X-Custom-Header': 'custom-value',
            [SOURCEBOT_USER_EMAIL_HEADER]: 'authenticated@example.com',
        });
    });

    test('resolves token-backed configured headers', async () => {
        const token = { env: 'CUSTOM_HEADER' };
        mocks.getTokenFromConfig.mockResolvedValue('resolved-value');

        await expect(resolveLanguageModelHeaders({ Authorization: token })).resolves.toEqual({
            Authorization: 'resolved-value',
        });
        expect(mocks.getTokenFromConfig).toHaveBeenCalledWith(token);
    });
});
