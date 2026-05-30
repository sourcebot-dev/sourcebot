import { beforeEach, describe, expect, test } from 'vitest';
import { MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY } from './constants';
import {
    consumeMcpOAuthDraftForPath,
    normalizeMcpOAuthDraftPath,
    resolveMcpOAuthDraftForPath,
    saveMcpOAuthDraft,
} from './mcpOAuthDraft';
import type { Descendant } from 'slate';
import type { SearchScope } from './types';

const children = [{
    type: 'paragraph',
    children: [{ text: 'check the Linear ticket' }],
}] satisfies Descendant[];

const selectedSearchScopes = [{
    type: 'repo',
    value: 'sourcebot/sourcebot',
    name: 'sourcebot/sourcebot',
    codeHostType: 'github',
}] satisfies SearchScope[];

const draft = {
    returnTo: '/chat/thread-1?scope=sourcebot',
    children,
    selectedSearchScopes,
    disabledMcpServerIds: ['server-disabled'],
    createdAt: 100,
};

describe('MCP OAuth draft persistence', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    test('normalizes chat paths and strips OAuth status params', () => {
        expect(normalizeMcpOAuthDraftPath('/chat/thread-1?scope=sourcebot&status=connected&server=Linear')).toBe('/chat/thread-1?scope=sourcebot');
        expect(normalizeMcpOAuthDraftPath('/settings/accountAskAgent')).toBeUndefined();
        expect(normalizeMcpOAuthDraftPath('https://evil.example.com/chat')).toBeUndefined();
        expect(normalizeMcpOAuthDraftPath('//evil.example.com/chat')).toBeUndefined();
    });

    test('resolves a draft for the same chat path after the OAuth callback adds status params', () => {
        const result = resolveMcpOAuthDraftForPath(
            JSON.stringify(draft),
            '/chat/thread-1?scope=sourcebot&status=connected&server=Linear',
            200,
        );

        expect(result.shouldClear).toBe(true);
        expect(result.draft).toEqual(draft);
    });

    test('keeps a draft when the current chat path does not match', () => {
        const result = resolveMcpOAuthDraftForPath(JSON.stringify(draft), '/chat/thread-2', 200);

        expect(result.shouldClear).toBe(false);
        expect(result.draft).toBeUndefined();
    });

    test('clears invalid and stale drafts', () => {
        expect(resolveMcpOAuthDraftForPath('{', '/chat/thread-1').shouldClear).toBe(true);
        expect(resolveMcpOAuthDraftForPath(JSON.stringify({ ...draft, children: [1] }), '/chat/thread-1?scope=sourcebot', 200).shouldClear).toBe(true);
        expect(resolveMcpOAuthDraftForPath(JSON.stringify(draft), '/chat/thread-1?scope=sourcebot', 30 * 60 * 1000 + 101).shouldClear).toBe(true);
    });

    test('saves and consumes the composer draft from sessionStorage', () => {
        saveMcpOAuthDraft({
            returnTo: '/chat/thread-1?scope=sourcebot&status=error',
            children,
            selectedSearchScopes,
            disabledMcpServerIds: ['server-disabled'],
        });

        const restoredDraft = consumeMcpOAuthDraftForPath('/chat/thread-1?scope=sourcebot&status=connected&server=Linear');

        expect(restoredDraft?.returnTo).toBe('/chat/thread-1?scope=sourcebot');
        expect(restoredDraft?.children).toEqual(children);
        expect(restoredDraft?.selectedSearchScopes).toEqual(selectedSearchScopes);
        expect(restoredDraft?.disabledMcpServerIds).toEqual(['server-disabled']);
        expect(sessionStorage.getItem(MCP_OAUTH_DRAFT_SESSION_STORAGE_KEY)).toBeNull();
    });
});
