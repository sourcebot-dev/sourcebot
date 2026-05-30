import { describe, expect, test } from 'vitest';
import { splitMcpServersForChatMenu } from './connectorsMenu';

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
