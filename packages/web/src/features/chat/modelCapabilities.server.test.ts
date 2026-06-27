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

import { lookupModelCapabilities, resolveModelCapabilities } from './modelCapabilities.server';
import type { ModelsDevCatalog } from './modelsDevCatalog.server';

const catalog: ModelsDevCatalog = {
    anthropic: {
        id: 'anthropic',
        models: {
            // Text + image + a document (pdf) container format.
            'claude-sonnet-4-5': {
                id: 'claude-sonnet-4-5',
                modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            },
        },
    },
    // models.dev keys Gemini under 'google', whereas Sourcebot's provider id is
    // 'google-generative-ai' — exercises the provider id override.
    google: {
        id: 'google',
        models: {
            'gemini-2.5-pro': {
                id: 'gemini-2.5-pro',
                modalities: { input: ['text', 'image', 'audio', 'video', 'pdf'], output: ['text'] },
            },
        },
    },
    openai: {
        id: 'openai',
        models: {
            // Catalogued model that omits `text` from its input list.
            'image-only': { id: 'image-only', modalities: { input: ['image'], output: ['text'] } },
            // Catalogued model with no `modalities` object at all.
            'no-modalities-model': { id: 'no-modalities-model' },
        },
    },
};

const model = (provider: string, modelId: string) =>
    ({ provider, model: modelId }) as Pick<LanguageModel, 'provider' | 'model'>;

describe('lookupModelCapabilities', () => {
    test('splits modalities and document types for a direct provider/model hit', () => {
        expect(lookupModelCapabilities(catalog, model('anthropic', 'claude-sonnet-4-5'))).toEqual({
            inputModalities: ['text', 'image'],
            supportedDocumentTypes: ['pdf'],
        });
    });

    test('maps google-generative-ai to the catalog\'s google key', () => {
        expect(lookupModelCapabilities(catalog, model('google-generative-ai', 'gemini-2.5-pro'))).toEqual({
            inputModalities: ['text', 'image', 'audio', 'video'],
            supportedDocumentTypes: ['pdf'],
        });
    });

    test('always includes text even when the catalog omits it', () => {
        expect(lookupModelCapabilities(catalog, model('openai', 'image-only'))).toEqual({
            inputModalities: ['text', 'image'],
            supportedDocumentTypes: [],
        });
    });

    test('falls back to text-only for a catalogued model with no modalities', () => {
        expect(lookupModelCapabilities(catalog, model('openai', 'no-modalities-model'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: [],
        });
    });

    test('falls back to text-only for an uncatalogued model (e.g. openai-compatible / self-hosted)', () => {
        expect(lookupModelCapabilities(catalog, model('openai-compatible', 'my-local-model'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: [],
        });
        expect(lookupModelCapabilities(catalog, model('anthropic', 'claude-unknown'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: [],
        });
    });

    test('falls back to text-only when the catalog is null (fetch failed / unreachable)', () => {
        expect(lookupModelCapabilities(null, model('anthropic', 'claude-sonnet-4-5'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: [],
        });
    });
});

describe('resolveModelCapabilities', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('fetches the catalog once in the background and resolves capabilities (incl. provider mapping)', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => catalog,
        }) as unknown as Response);
        vi.stubGlobal('fetch', fetchMock);

        // The request path never blocks on the fetch: the first lookup kicks off
        // the background fetch and falls back to text-only while it's in flight.
        expect(await resolveModelCapabilities(model('anthropic', 'claude-sonnet-4-5'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: [],
        });

        // Once the background fetch settles, lookups resolve from the cached catalog.
        await vi.waitFor(async () => {
            expect(await resolveModelCapabilities(model('anthropic', 'claude-sonnet-4-5'))).toEqual({
                inputModalities: ['text', 'image'],
                supportedDocumentTypes: ['pdf'],
            });
        });

        // Subsequent lookups reuse the cached catalog rather than refetching.
        expect(await resolveModelCapabilities(model('google-generative-ai', 'gemini-2.5-pro'))).toEqual({
            inputModalities: ['text', 'image', 'audio', 'video'],
            supportedDocumentTypes: ['pdf'],
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
