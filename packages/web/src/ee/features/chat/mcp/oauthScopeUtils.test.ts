import { describe, expect, test } from 'vitest';
import {
    buildMcpOAuthScopeEntries,
    normalizeMcpRequestedOAuthScopes,
    getEnabledMcpOAuthScopeNames,
} from './oauthScopeUtils';

describe('normalizeMcpRequestedOAuthScopes', () => {
    test('deduplicates, trims, and sorts scopes', () => {
        expect(normalizeMcpRequestedOAuthScopes([' repo ', 'read:user', 'repo'])).toEqual([
            'read:user',
            'repo',
        ]);
    });

    test('filters blank strings', () => {
        expect(normalizeMcpRequestedOAuthScopes(['', '  ', 'read'])).toEqual(['read']);
    });
});

describe('buildMcpOAuthScopeEntries', () => {
    test('enables scopes that are in requestedOAuthScopes', () => {
        const entries = buildMcpOAuthScopeEntries({
            availableOAuthScopes: ['read', 'write'],
            requestedOAuthScopes: ['read'],
        });

        expect(entries).toEqual([
            { scope: 'read', enabled: true },
            { scope: 'write', enabled: false },
        ]);
    });

    test('does not special-case offline_access; it is enabled only when requested', () => {
        const entries = buildMcpOAuthScopeEntries({
            availableOAuthScopes: ['offline_access', 'read'],
            requestedOAuthScopes: [],
        });

        expect(entries).toEqual([
            { scope: 'offline_access', enabled: false },
            { scope: 'read', enabled: false },
        ]);
    });

    test('merges requested scopes not in available scopes into the output', () => {
        const entries = buildMcpOAuthScopeEntries({
            availableOAuthScopes: ['read'],
            requestedOAuthScopes: ['write'],
        });

        expect(entries).toEqual([
            { scope: 'read', enabled: false },
            { scope: 'write', enabled: true },
        ]);
    });

    test('returns sorted, deduplicated entries', () => {
        const entries = buildMcpOAuthScopeEntries({
            availableOAuthScopes: ['write', 'read', 'write'],
            requestedOAuthScopes: ['write', 'write'],
        });

        expect(entries).toEqual([
            { scope: 'read', enabled: false },
            { scope: 'write', enabled: true },
        ]);
    });
});

describe('getEnabledMcpOAuthScopeNames', () => {
    test('returns only enabled scopes, sorted and deduplicated', () => {
        const scopes = getEnabledMcpOAuthScopeNames([
            { scope: 'write', enabled: false },
            { scope: 'read', enabled: true },
            { scope: 'offline_access', enabled: true },
        ]);

        expect(scopes).toEqual(['offline_access', 'read']);
    });
});
