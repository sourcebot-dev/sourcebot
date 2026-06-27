import 'server-only';

import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { loadCatalog, resolveProviderId, type ModelsDevCatalog } from './modelsDevCatalog.server';

// Re-exported so existing consumers/tests can keep importing the catalog type
// from here.
export type { ModelsDevCatalog } from './modelsDevCatalog.server';

/**
 * Pure lookup of a model's context window in a models.dev catalog. Separated
 * from the network fetch so it can be unit-tested directly.
 *
 * Returns the total context window in tokens, or `undefined` when the model 
 * isn't catalogued or has no usable window.
 */
export const lookupContextWindow = (
    catalog: ModelsDevCatalog | null,
    config: Pick<LanguageModel, 'provider' | 'model'>,
): number | undefined => {
    if (!catalog) {
        return undefined;
    }
    const providerId = resolveProviderId(config.provider);
    const context = catalog[providerId]?.models?.[config.model]?.limit?.context;
    // `limit` is schema-optional, and models.dev reports a 0 context window for
    // non-text models (image/audio/etc.). Treat both as "unknown" so the UI
    // gracefully omits the gauge rather than rendering a bogus denominator.
    return typeof context === 'number' && context > 0 ? context : undefined;
};

export const resolveContextWindow = async (
    config: Pick<LanguageModel, 'provider' | 'model'>,
): Promise<number | undefined> => {
    const catalog = await loadCatalog();
    return lookupContextWindow(catalog, config);
};
