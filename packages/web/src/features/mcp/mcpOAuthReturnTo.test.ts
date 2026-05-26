import { describe, expect, test } from 'vitest';
import {
    createMcpOAuthState,
    getMcpOAuthReturnToFromState,
    normalizeMcpOAuthReturnTo,
} from './mcpOAuthReturnTo';

describe('MCP OAuth return paths', () => {
    test('allows chat return paths', () => {
        expect(normalizeMcpOAuthReturnTo('/chat')).toBe('/chat');
        expect(normalizeMcpOAuthReturnTo('/chat/thread-1?foo=bar')).toBe('/chat/thread-1?foo=bar');
    });

    test('allows connector settings return paths', () => {
        expect(normalizeMcpOAuthReturnTo('/settings/accountAskAgent?status=connected')).toBe('/settings/accountAskAgent?status=connected');
    });

    test('rejects external and unrelated return paths', () => {
        expect(normalizeMcpOAuthReturnTo('https://evil.example.com/chat')).toBeUndefined();
        expect(normalizeMcpOAuthReturnTo('//evil.example.com/chat')).toBeUndefined();
        expect(normalizeMcpOAuthReturnTo('/settings')).toBeUndefined();
    });

    test('encodes and decodes return paths inside OAuth state', () => {
        const state = createMcpOAuthState('nonce-1', '/chat');

        expect(state).not.toBe('nonce-1');
        expect(getMcpOAuthReturnToFromState(state)).toBe('/chat');
    });

    test('leaves state unchanged when no valid return path exists', () => {
        expect(createMcpOAuthState('nonce-1')).toBe('nonce-1');
        expect(createMcpOAuthState('nonce-1', '/settings')).toBe('nonce-1');
        expect(getMcpOAuthReturnToFromState('nonce-1')).toBeUndefined();
    });
});
