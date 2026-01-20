
import { expect, test, vi, describe, beforeEach } from 'vitest';
import { getGerritReposFromConfig } from './gerrit';
import fetch from 'cross-fetch';

vi.mock('cross-fetch', () => {
    return {
        default: vi.fn(),
    };
});

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('./utils', () => ({
    measure: async (fn: () => any) => {
        const data = await fn();
        return { durationMs: 0, data };
    },
    fetchWithRetry: async (fn: () => any) => fn(),
}));

describe('getGerritReposFromConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('sends Basic Auth header when username and password are provided', async () => {
        const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '[]',
            json: async () => ([]),
        });

        const config = {
            type: 'gerrit' as const,
            url: 'https://gerrit.example.com',
            username: 'user',
            password: 'password',
        };

        await getGerritReposFromConfig(config);

        const expectedToken = Buffer.from('user:password').toString('base64');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('https://gerrit.example.com/projects/?S=0'),
            expect.objectContaining({
                headers: {
                    Authorization: `Basic ${expectedToken}`,
                },
            })
        );
    });

    test('does not send Authorization header when credentials are missing', async () => {
        const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '[]',
            json: async () => ([]),
        });

        const config = {
            type: 'gerrit' as const,
            url: 'https://gerrit.example.com',
        };

        await getGerritReposFromConfig(config);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('https://gerrit.example.com/projects/?S=0'),
            expect.objectContaining({
                headers: {},
            })
        );
    });

    test('does not send Authorization header when only one credential is provided', async () => {
        const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '[]',
            json: async () => ([]),
        });

        const config = {
            type: 'gerrit' as const,
            url: 'https://gerrit.example.com',
            username: 'user',
        };

        await getGerritReposFromConfig(config);

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('https://gerrit.example.com/projects/?S=0'),
            expect.objectContaining({
                headers: {},
            })
        );
    });

    test('correctly encodes credentials with special characters', async () => {
        const mockFetch = fetch as unknown as ReturnType<typeof vi.fn>;
        mockFetch.mockResolvedValue({
            ok: true,
            text: async () => '[]',
            json: async () => ([]),
        });

        const config = {
            type: 'gerrit' as const,
            url: 'https://gerrit.example.com',
            username: 'user@example.com',
            password: 'p@ss:w0rd',
        };

        await getGerritReposFromConfig(config);

        const expectedToken = Buffer.from('user@example.com:p@ss:w0rd').toString('base64');
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('https://gerrit.example.com/projects/?S=0'),
            expect.objectContaining({
                headers: {
                    Authorization: `Basic ${expectedToken}`,
                },
            })
        );
    });
});
