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

import { lookupModelCapabilities, providerSupportsPdfDocuments, resolveModelCapabilities } from './modelCapabilities.server';
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
            // Text + pdf on a PDF-capable adapter.
            'gpt-pdf': { id: 'gpt-pdf', modalities: { input: ['text', 'pdf'], output: ['text'] } },
        },
    },
    // Providers whose adapter cannot carry a PDF file part even though the
    // catalogued model lists `pdf` in its input modalities.
    'amazon-bedrock': {
        id: 'amazon-bedrock',
        models: {
            'claude-on-bedrock': {
                id: 'claude-on-bedrock',
                modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            },
        },
    },
    xai: {
        id: 'xai',
        models: {
            'grok-vision': {
                id: 'grok-vision',
                modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            },
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

    test('keeps PDF support for a provider whose adapter can carry PDF file parts', () => {
        expect(lookupModelCapabilities(catalog, model('openai', 'gpt-pdf'))).toEqual({
            inputModalities: ['text'],
            supportedDocumentTypes: ['pdf'],
        });
    });

    test('drops PDF support for a provider whose adapter cannot carry PDF file parts, keeping modalities', () => {
        // The catalog lists pdf for these models, but the adapter (amazon-bedrock
        // is image-only; xai is version/back-end dependent) cannot send it, so we
        // fail closed on the document axis while preserving image input.
        expect(lookupModelCapabilities(catalog, model('amazon-bedrock', 'claude-on-bedrock'))).toEqual({
            inputModalities: ['text', 'image'],
            supportedDocumentTypes: [],
        });
        expect(lookupModelCapabilities(catalog, model('xai', 'grok-vision'))).toEqual({
            inputModalities: ['text', 'image'],
            supportedDocumentTypes: [],
        });
    });
});

describe('providerSupportsPdfDocuments', () => {
    test('allows first-party adapters known to carry PDF file parts', () => {
        for (const provider of ['anthropic', 'openai', 'azure', 'google-generative-ai', 'google-vertex', 'google-vertex-anthropic'] as const) {
            expect(providerSupportsPdfDocuments(provider)).toBe(true);
        }
    });

    test('fails closed for adapters that are image-only or back-end/version dependent', () => {
        for (const provider of ['amazon-bedrock', 'xai', 'openrouter', 'openai-compatible', 'mistral', 'deepseek'] as const) {
            expect(providerSupportsPdfDocuments(provider)).toBe(false);
        }
    });
});

describe('resolveModelCapabilities', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('blocks on the first (cold) fetch and then serves capabilities from cache (incl. provider mapping)', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            json: async () => catalog,
        }) as unknown as Response);
        vi.stubGlobal('fetch', fetchMock);

        // The genuinely-first resolution blocks on the cold fetch (bounded) so
        // capabilities resolve correctly instead of silently degrading to
        // text-only right after a process start.
        expect(await resolveModelCapabilities(model('anthropic', 'claude-sonnet-4-5'))).toEqual({
            inputModalities: ['text', 'image'],
            supportedDocumentTypes: ['pdf'],
        });

        // Subsequent lookups reuse the cached catalog (incl. provider mapping)
        // rather than refetching or blocking again.
        expect(await resolveModelCapabilities(model('google-generative-ai', 'gemini-2.5-pro'))).toEqual({
            inputModalities: ['text', 'image', 'audio', 'video'],
            supportedDocumentTypes: ['pdf'],
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
