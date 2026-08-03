import { beforeEach, describe, expect, test } from 'vitest';
import { MCP_RECONNECT_SESSION_STORAGE_KEY } from './constants';
import {
    clearMcpPendingReconnect,
    consumeMcpPendingReconnectForPath,
    resolveMcpPendingReconnectForPath,
    saveMcpPendingReconnect,
} from './mcpReconnect';

const NOW = 1_700_000_000_000;

const createStoredPending = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    serverId: 'server-1',
    serverName: 'Linear',
    toolCallId: 'tool-call-1',
    returnTo: '/chat/abc123',
    createdAt: NOW,
    ...overrides,
});

describe('resolveMcpPendingReconnectForPath', () => {
    test('returns the pending reconnect when the current path matches', () => {
        const result = resolveMcpPendingReconnectForPath(createStoredPending(), '/chat/abc123', NOW + 1000);
        expect(result.shouldClear).toBe(true);
        expect(result.pending).toMatchObject({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
        });
    });

    test('ignores OAuth status query parameters on the current path', () => {
        const result = resolveMcpPendingReconnectForPath(
            createStoredPending(),
            '/chat/abc123?status=connected&server=Linear',
            NOW + 1000,
        );
        expect(result.pending).toBeDefined();
        expect(result.shouldClear).toBe(true);
    });

    test('keeps the pending reconnect when the current path is a different thread', () => {
        const result = resolveMcpPendingReconnectForPath(createStoredPending(), '/chat/other', NOW + 1000);
        expect(result.pending).toBeUndefined();
        expect(result.shouldClear).toBe(false);
    });

    test('clears when the stored value is not valid JSON or has the wrong shape', () => {
        expect(resolveMcpPendingReconnectForPath('not-json', '/chat/abc123', NOW).shouldClear).toBe(true);
        expect(resolveMcpPendingReconnectForPath(JSON.stringify({ serverId: 'server-1' }), '/chat/abc123', NOW).shouldClear).toBe(true);
    });

    test('clears when the pending reconnect has expired', () => {
        const result = resolveMcpPendingReconnectForPath(
            createStoredPending(),
            '/chat/abc123',
            NOW + 31 * 60 * 1000,
        );
        expect(result.pending).toBeUndefined();
        expect(result.shouldClear).toBe(true);
    });

    test('clears when the stored return path is not an allowed chat path', () => {
        const result = resolveMcpPendingReconnectForPath(
            createStoredPending({ returnTo: '/settings/accountAskAgent' }),
            '/chat/abc123',
            NOW,
        );
        expect(result.pending).toBeUndefined();
        expect(result.shouldClear).toBe(true);
    });

    test('does nothing when no value is stored', () => {
        expect(resolveMcpPendingReconnectForPath(null, '/chat/abc123', NOW)).toEqual({ shouldClear: false });
    });
});

describe('sessionStorage round trip', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    test('saves, consumes, and clears the pending reconnect', () => {
        saveMcpPendingReconnect({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
        });
        expect(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY)).not.toBeNull();

        const pending = consumeMcpPendingReconnectForPath('/chat/abc123?status=connected');
        expect(pending?.serverId).toBe('server-1');
        expect(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY)).toBeNull();
    });

    test('does not save a pending reconnect for a disallowed return path', () => {
        saveMcpPendingReconnect({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: 'https://evil.example.com/chat',
        });
        expect(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY)).toBeNull();
    });

    test('clearMcpPendingReconnect removes the stored value', () => {
        saveMcpPendingReconnect({
            serverId: 'server-1',
            serverName: 'Linear',
            toolCallId: 'tool-call-1',
            returnTo: '/chat/abc123',
        });
        clearMcpPendingReconnect();
        expect(window.sessionStorage.getItem(MCP_RECONNECT_SESSION_STORAGE_KEY)).toBeNull();
    });
});
