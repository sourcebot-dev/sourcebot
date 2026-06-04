import { describe, expect, test } from 'vitest';
import { ErrorCode } from '@/lib/errorCodes';
import { McpServersLoadError, shouldRetryMcpServersLoad, splitMcpServersForChatMenu } from './connectorsMenu';

describe('splitMcpServersForChatMenu', () => {
    test('keeps connected and expired servers separate from connectable approved servers', () => {
        const servers = [
            { id: 'connected', isConnected: true, isAuthExpired: false },
            { id: 'expired', isConnected: false, isAuthExpired: true },
            { id: 'approved', isConnected: false, isAuthExpired: false },
        ];

        const { connectedServers, connectableServers } = splitMcpServersForChatMenu(servers);

        expect(connectedServers.map((server) => server.id)).toEqual(['connected', 'expired']);
        expect(connectableServers.map((server) => server.id)).toEqual(['approved']);
    });
});

describe('shouldRetryMcpServersLoad', () => {
    test('does not retry authentication failures', () => {
        const error = new McpServersLoadError({
            statusCode: 401,
            errorCode: ErrorCode.NOT_AUTHENTICATED,
            message: 'Not authenticated',
        });

        expect(shouldRetryMcpServersLoad(0, error)).toBe(false);
    });

    test('retries other failures up to the default react-query cap', () => {
        const error = new Error('network down');

        expect(shouldRetryMcpServersLoad(0, error)).toBe(true);
        expect(shouldRetryMcpServersLoad(2, error)).toBe(true);
        expect(shouldRetryMcpServersLoad(3, error)).toBe(false);
    });
});
