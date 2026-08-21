import { describe, expect, test } from 'vitest';
import { isMcpActivityMessage } from './activity';

describe('isMcpActivityMessage', () => {
    test('treats a valid tool call as activity', () => {
        expect(isMcpActivityMessage({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'grep',
                arguments: { query: 'activity' },
            },
        })).toBe(true);
    });

    test('treats a tool call in a JSON-RPC batch as activity', () => {
        expect(isMcpActivityMessage([
            {
                jsonrpc: '2.0',
                id: 1,
                method: 'ping',
            },
            {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: { name: 'grep' },
            },
        ])).toBe(true);
    });

    test.each([
        ['initialize', {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2025-11-25',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' },
            },
        }],
        ['initialized notification', {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
        }],
        ['ping', {
            jsonrpc: '2.0',
            id: 2,
            method: 'ping',
        }],
        ['tool discovery', {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/list',
        }],
        ['malformed tool call', {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {},
        }],
        ['tool call without a JSON-RPC envelope', {
            method: 'tools/call',
            params: { name: 'grep' },
        }],
    ])('does not treat %s as activity', (_name, message) => {
        expect(isMcpActivityMessage(message)).toBe(false);
    });
});
