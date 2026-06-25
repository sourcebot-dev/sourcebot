import { afterEach, describe, expect, test, vi } from 'vitest';
import type { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';

vi.mock('server-only', () => ({ default: vi.fn() }));

vi.mock('@sourcebot/shared', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

import { lookupContextWindow, resolveContextWindow, type ModelsDevCatalog } from './modelContextWindow.server';

const catalog: ModelsDevCatalog = {
    anthropic: {
        id: 'anthropic',
        models: {
            'claude-sonnet-4-5': { id: 'claude-sonnet-4-5', limit: { context: 200000, output: 64000 } },
        },
    },
    // models.dev keys Gemini under 'google', whereas Sourcebot's provider id is
    // 'google-generative-ai' — exercises PROVIDER_ID_OVERRIDES.
    google: {
        id: 'google',
        models: {
            'gemini-2.5-pro': { id: 'gemini-2.5-pro', limit: { context: 1048576, output: 65536 } },
        },
    },
    openai: {
        id: 'openai',
        models: {
            'gpt-4.1': { id: 'gpt-4.1', limit: { context: 1047576 } },
            // Non-text model: models.dev reports a 0 context window.
            'gpt-image-1': { id: 'gpt-image-1', limit: { context: 0, output: 0 } },
            // Catalogued model with no `limit` object at all.
            'no-limit-model': { id: 'no-limit-model' },
        },
    },
};

const model = (provider: string, modelId: string) =>
    ({ provider, model: modelId }) as Pick<LanguageModel, 'provider' | 'model'>;

describe('lookupContextWindow', () => {
    test('returns the context window for a direct provider/model hit', () => {
        expect(lookupContextWindow(catalog, model('anthropic', 'claude-sonnet-4-5'))).toBe(200000);
        expect(lookupContextWindow(catalog, model('openai', 'gpt-4.1'))).toBe(1047576);
    });

    test('maps google-generative-ai to the catalog\'s google key', () => {
        expect(lookupContextWindow(catalog, model('google-generative-ai', 'gemini-2.5-pro'))).toBe(1048576);
    });

    test('returns undefined for an uncatalogued provider', () => {
        expect(lookupContextWindow(catalog, model('mistral', 'mistral-large-latest'))).toBeUndefined();
    });

    test('returns undefined for an uncatalogued model id (e.g. openai-compatible / self-hosted)', () => {
        expect(lookupContextWindow(catalog, model('openai-compatible', 'my-local-model'))).toBeUndefined();
        expect(lookupContextWindow(catalog, model('anthropic', 'claude-unknown'))).toBeUndefined();
    });

    test('treats a 0 context window (non-text models) as unknown', () => {
        expect(lookupContextWindow(catalog, model('openai', 'gpt-image-1'))).toBeUndefined();
    });

    test('treats a missing limit object as unknown', () => {
        expect(lookupContextWindow(catalog, model('openai', 'no-limit-model'))).toBeUndefined();
    });

    test('returns undefined when the catalog is null (fetch failed / unreachable)', () => {
        expect(lookupContextWindow(null, model('anthropic', 'claude-sonnet-4-5'))).toBeUndefined();
    });
});

describe('resolveContextWindow', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('fetches the catalog once and resolves windows (incl. provider mapping)', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => catalog,
        }) as unknown as Response);
        vi.stubGlobal('fetch', fetchMock);

        expect(await resolveContextWindow(model('anthropic', 'claude-sonnet-4-5'))).toBe(200000);
        // Subsequent lookups reuse the cached catalog rather than refetching.
        expect(await resolveContextWindow(model('google-generative-ai', 'gemini-2.5-pro'))).toBe(1048576);
        expect(await resolveContextWindow(model('openai-compatible', 'my-local-model'))).toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
