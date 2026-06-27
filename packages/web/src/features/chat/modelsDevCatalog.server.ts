import 'server-only';

import { createLogger } from '@sourcebot/shared';

const logger = createLogger('models-dev-catalog');

// The same public, unauthenticated catalog the setup wizard already consumes
// (see packages/setupWizard/src/models.ts). Each model entry exposes a
// `limit.context` field (total context window in tokens) and a `modalities`
// field describing the inputs/outputs the model supports natively.
const MODELS_DEV_API_URL = 'https://models.dev/api.json';
const FETCH_TIMEOUT_MS = 8000;
// Re-fetch the (~2.4 MB) catalog at most once per this interval per server
// process. New models trickle in daily; a stale window for a few hours is fine.
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
// After a failed fetch, don't reattempt for this long. Without it, an outage in
// models.dev would make every chat send pay the fetch timeout on the request path.
const NEGATIVE_CACHE_MS = 60 * 1000;

// Sourcebot provider id -> models.dev top-level catalog key. Only providers
// whose Sourcebot id differs from the models.dev id need an entry; everything
// else (anthropic, openai, azure, amazon-bedrock, mistral, deepseek, xai,
// openrouter, google-vertex, google-vertex-anthropic) matches 1:1.
const PROVIDER_ID_OVERRIDES: Record<string, string> = {
    'google-generative-ai': 'google',
};

export const resolveProviderId = (provider: string): string =>
    PROVIDER_ID_OVERRIDES[provider] ?? provider;

type ModelsDevModel = {
    id: string;
    limit?: {
        context?: number;
        output?: number;
    };
    modalities?: {
        // e.g. ["text", "image", "pdf", "audio", "video"]
        input?: string[];
        output?: string[];
    };
};

type ModelsDevProvider = {
    id: string;
    models?: Record<string, ModelsDevModel>;
};

export type ModelsDevCatalog = Record<string, ModelsDevProvider>;

// Last successfully-fetched catalog. Served while fresh, and kept as a fallback
// when a later refresh fails. `catalogFetchedAt` is when it was fetched (TTL),
// `lastFailedAt` the most recent fetch failure (negative-cache backoff), and
// `inFlightFetch` dedupes concurrent fetches.
let cachedCatalog: ModelsDevCatalog | null = null;
let catalogFetchedAt = 0;
let lastFailedAt = 0;
let inFlightFetch: Promise<ModelsDevCatalog | null> | null = null;

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

/**
 * Returns the cached models.dev catalog, refreshing it in the background when
 * stale. Only the very first load blocks on the network; thereafter the
 * last-known-good catalog is served immediately (even if stale) so the request
 * path never waits on models.dev.
 */
export const loadCatalog = async (): Promise<ModelsDevCatalog | null> => {
    const now = Date.now();
    const isFresh = cachedCatalog !== null && now - catalogFetchedAt <= CATALOG_TTL_MS;
    const isBackingOff = now - lastFailedAt < NEGATIVE_CACHE_MS;

    // Kick off a (deduped) refresh when the cache is stale/empty and we're not
    // within the post-failure backoff window. On success it replaces the cache;
    // on failure it only records the failure time, leaving the last-known-good
    // catalog intact.
    if (!isFresh && !isBackingOff && !inFlightFetch) {
        inFlightFetch = fetchCatalog().then((catalog) => {
            if (catalog) {
                cachedCatalog = catalog;
                catalogFetchedAt = Date.now();
            } else {
                lastFailedAt = Date.now();
            }
            inFlightFetch = null;
            return catalog;
        });
    }

    // Once a catalog has loaded once, never block the request path on the
    // network: serve the last-known-good value (even if stale) and let any
    // refresh settle in the background. Only the very first load awaits.
    if (cachedCatalog !== null) {
        return cachedCatalog;
    }
    return inFlightFetch ?? null;
};
