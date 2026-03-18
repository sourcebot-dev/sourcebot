/**
 * Tests for the select:repo feature in the MCP server.
 *
 * Covers:
 * 1. repoResultSchema / searchResponseSchema validation
 * 2. The hasModifiers transform fix in search_code
 * 3. The search_repos tool end-to-end via InMemoryTransport
 *
 * Run with:
 *   node --import tsx/esm --test src/__tests__/select-repo.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { repoResultSchema, searchResponseSchema } from '../schemas.js';

// ---- helpers ----------------------------------------------------------------

function makeStats() {
    return {
        actualMatchCount: 0, totalMatchCount: 0, duration: 0, fileCount: 0,
        filesSkipped: 0, contentBytesLoaded: 0, indexBytesLoaded: 0, crashes: 0,
        shardFilesConsidered: 0, filesConsidered: 0, filesLoaded: 0,
        shardsScanned: 0, shardsSkipped: 0, shardsSkippedFilter: 0,
        ngramMatches: 0, ngramLookups: 0, wait: 0,
        matchTreeConstruction: 0, matchTreeSearch: 0,
        regexpsConsidered: 0, flushReason: 'none',
    };
}

function makeSearchResponse(extra: Record<string, unknown> = {}) {
    return { stats: makeStats(), files: [], repositoryInfo: [], isSearchExhaustive: true, ...extra };
}

function mockFetch(payload: unknown) {
    globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function captureFetch(payload: unknown, onCall: (body: Record<string, unknown>) => void) {
    globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
        onCall(JSON.parse((init?.body as string) ?? '{}'));
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
}

function getText(result: unknown): string {
    return (result as { content: Array<{ type: string; text: string }> }).content
        .map((c) => c.text).join('\n');
}

// ---- 1. Schema validation ---------------------------------------------------

describe('repoResultSchema', () => {
    it('parses a valid RepoResult', () => {
        const r = repoResultSchema.safeParse({ repositoryId: 1, repository: 'github.com/acme/frontend', matchCount: 42 });
        assert.ok(r.success);
        assert.equal(r.data.matchCount, 42);
    });

    it('parses a RepoResult with optional repositoryInfo', () => {
        const r = repoResultSchema.safeParse({
            repositoryId: 2, repository: 'github.com/acme/backend', matchCount: 7,
            repositoryInfo: { id: 2, codeHostType: 'github', name: 'acme/backend', webUrl: 'https://github.com/acme/backend' },
        });
        assert.ok(r.success);
        assert.equal(r.data.repositoryInfo?.webUrl, 'https://github.com/acme/backend');
    });

    it('rejects a RepoResult missing matchCount', () => {
        const r = repoResultSchema.safeParse({ repositoryId: 1, repository: 'github.com/acme/x' });
        assert.ok(!r.success, 'should have failed');
    });
});

describe('searchResponseSchema with repoResults', () => {
    it('accepts a response without repoResults (backward compat)', () => {
        const r = searchResponseSchema.safeParse(makeSearchResponse());
        assert.ok(r.success);
        assert.equal(r.data.repoResults, undefined);
    });

    it('accepts a response with repoResults', () => {
        const r = searchResponseSchema.safeParse(makeSearchResponse({
            repoResults: [
                { repositoryId: 1, repository: 'github.com/acme/a', matchCount: 10 },
                { repositoryId: 2, repository: 'github.com/acme/b', matchCount: 3 },
            ],
        }));
        assert.ok(r.success);
        assert.equal(r.data.repoResults?.length, 2);
    });

    it('rejects repoResults with a missing required field', () => {
        const r = searchResponseSchema.safeParse(makeSearchResponse({
            repoResults: [{ repositoryId: 1, repository: 'github.com/x' }],
        }));
        assert.ok(!r.success, 'should have failed');
    });
});

// ---- 2. hasModifiers transform logic ----------------------------------------

describe('search_code query transform — hasModifiers regex', () => {
    const RE = /(?:^|\s)(?:select|repo|lang|file|case|rev|branch|sym|content):/;

    it('detects select:repo modifier', () => assert.ok(RE.test('useState select:repo')));
    it('detects lang: modifier', () => assert.ok(RE.test('function lang:TypeScript')));
    it('detects repo: at start', () => assert.ok(RE.test('repo:acme/frontend useState')));
    it('does not false-positive on plain text', () => {
        assert.ok(!RE.test('useState hook'));
        assert.ok(!RE.test('async function fetch'));
    });
    it('does not match partial words (selector:hover)', () => assert.ok(!RE.test('selector:hover')));
});

// ---- 3. search_repos tool (end-to-end) --------------------------------------

describe('search_repos tool', () => {
    let client: Client;
    let savedFetch: typeof globalThis.fetch;

    before(async () => {
        savedFetch = globalThis.fetch;
        process.env.SOURCEBOT_HOST = 'http://localhost:3000';
        process.env.SOURCEBOT_API_KEY = 'test-key';

        // Dynamic import so env vars are set first
        const { server } = await import('../index.js');
        const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
        await server.connect(serverTransport);
        client = new Client({ name: 'test-client', version: '0.0.1' });
        await client.connect(clientTransport);
    });

    after(async () => {
        await client?.close();
        globalThis.fetch = savedFetch;
    });

    it('returns repo list from API repoResults', async () => {
        mockFetch(makeSearchResponse({
            repoResults: [
                { repositoryId: 1, repository: 'github.com/acme/frontend', matchCount: 20 },
                { repositoryId: 2, repository: 'github.com/acme/backend', matchCount: 5 },
            ],
        }));
        const text = getText(await client.callTool({ name: 'search_repos', arguments: { query: 'useState' } }));
        assert.ok(text.includes('github.com/acme/frontend'));
        assert.ok(text.includes('github.com/acme/backend'));
        assert.ok(text.includes('matches: 20'));
    });

    it('returns no-results message when repoResults is empty', async () => {
        mockFetch(makeSearchResponse({ repoResults: [] }));
        const text = getText(await client.callTool({ name: 'search_repos', arguments: { query: 'nonExistentSymbol' } }));
        assert.ok(text.toLowerCase().includes('no repositories'));
    });

    it('appends select:repo and lang: filters to the query', async () => {
        let captured = '';
        captureFetch(makeSearchResponse({ repoResults: [] }), (body) => { captured = body.query as string; });
        await client.callTool({ name: 'search_repos', arguments: { query: 'useState', filterByLanguages: ['TypeScript', 'JavaScript'] } });
        assert.ok(captured.includes('lang:TypeScript'), `query: ${captured}`);
        assert.ok(captured.includes('lang:JavaScript'), `query: ${captured}`);
        assert.ok(captured.includes('select:repo'), `query: ${captured}`);
    });

    it('respects maxResults limit', async () => {
        const repos = Array.from({ length: 10 }, (_, i) => ({
            repositoryId: i, repository: `github.com/acme/repo-${i}`, matchCount: 10 - i,
        }));
        mockFetch(makeSearchResponse({ repoResults: repos }));
        const text = getText(await client.callTool({ name: 'search_repos', arguments: { query: 'test', maxResults: 3 } }));
        assert.ok(text.includes('10 repositor'), `missing total: ${text}`);
        assert.ok(text.includes('top 3'), `missing limit notice: ${text}`);
        const lines = text.split('\n').filter((l: string) => l.startsWith('repo:'));
        assert.equal(lines.length, 3);
    });
});
