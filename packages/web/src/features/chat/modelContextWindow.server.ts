import 'server-only';

import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { createLogger } from '@sourcebot/shared';

const logger = createLogger('model-context-window');

// The same public, unauthenticated catalog the setup wizard already consumes
// (see packages/setupWizard/src/models.ts). Each model entry exposes a
// `limit.context` field holding the total context window in tokens.
const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const FETCH_TIMEOUT_MS = 8000;
// Re-fetch the (~2.4 MB) catalog at most once per this interval per server
// process. New models trickle in daily; a stale window for a few hours is fine.
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

// Sourcebot provider id -> models.dev top-level catalog key. Only providers
// whose Sourcebot id differs from the models.dev id need an entry; everything
// else (anthropic, openai, azure, amazon-bedrock, mistral, deepseek, xai,
// openrouter, google-vertex, google-vertex-anthropic) matches 1:1.
const PROVIDER_ID_OVERRIDES: Record<string, string> = {
    'google-generative-ai': 'google',
};

type ModelsDevModel = {
    id: string;
    limit?: {
        context?: number;
        output?: number;
    };
};

type ModelsDevProvider = {
    id: string;
    models?: Record<string, ModelsDevModel>;
};

export type ModelsDevCatalog = Record<string, ModelsDevProvider>;

let catalogPromise: Promise<ModelsDevCatalog | null> | null = null;
let catalogFetchedAt = 0;

const fetchCatalog = async (): Promise<ModelsDevCatalog | null> => {
    try {
        const response = await fetch(MODELS_DEV_API_URL, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!response.ok) {
            logger.warn(`Failed to fetch models.dev catalog: ${response.status} ${response.statusText}`);
            return null;
        }
        return await response.json() as ModelsDevCatalog;
    } catch (error) {
        logger.warn(`Failed to fetch models.dev catalog: ${error}`);
        return null;
    }
};

const loadCatalog = async (): Promise<ModelsDevCatalog | null> => {
    const now = Date.now();
    if (!catalogPromise || now - catalogFetchedAt > CATALOG_TTL_MS) {
        catalogFetchedAt = now;
        catalogPromise = fetchCatalog().then((catalog) => {
            // Don't memoize failures — let the next caller retry instead of
            // being stuck with a null catalog until the TTL expires.
            if (!catalog) {
                catalogPromise = null;
            }
            return catalog;
        });
    }
    return catalogPromise;
};

/**
 * Pure lookup of a model's context window in a models.dev catalog. Separated
 * from the network fetch so it can be unit-tested directly.
 *
 * Returns the total context window (input + output share it) in tokens, or
 * `undefined` when the model isn't catalogued or has no usable window.
 */
export const lookupContextWindow = (
    catalog: ModelsDevCatalog | null,
    config: Pick<LanguageModel, 'provider' | 'model'>,
): number | undefined => {
    if (!catalog) {
        return undefined;
    }
    const providerId = PROVIDER_ID_OVERRIDES[config.provider] ?? config.provider;
    const context = catalog[providerId]?.models?.[config.model]?.limit?.context;
    // `limit` is schema-optional, and models.dev reports a 0 context window for
    // non-text models (image/audio/etc.). Treat both as "unknown" so the UI
    // gracefully omits the gauge rather than rendering a bogus denominator.
    return typeof context === 'number' && context > 0 ? context : undefined;
};

/**
 * Resolves the context window (in tokens) for a configured language model from
 * the models.dev catalog. Returns `undefined` when unknown — e.g. arbitrary
 * openai-compatible / self-hosted ids, provider/model ids that don't match the
 * catalog's keys (bedrock ARNs, vertex `@`-suffixed ids, azure deployments), or
 * when models.dev is unreachable. Never throws into the request path.
 */
export const resolveContextWindow = async (
    config: Pick<LanguageModel, 'provider' | 'model'>,
): Promise<number | undefined> => {
    const catalog = await loadCatalog();
    return lookupContextWindow(catalog, config);
};
