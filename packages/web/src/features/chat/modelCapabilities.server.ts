import 'server-only';

import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { DocumentType, InputModality } from './types';
import { loadCatalog, resolveProviderId, type ModelsDevCatalog } from './modelsDevCatalog.server';

// models.dev folds every accepted input — perceptual channels (text, image,
// audio, video) AND container formats (pdf) — into a single `modalities.input`
// list. Sourcebot keeps those two concepts apart: `inputModalities` are the
// raw channels a model encodes, while `supportedDocumentTypes` are rich
// compound formats providers decompose server-side. We partition the catalog's
// input list into those two buckets here.
const INPUT_MODALITY_VALUES = ['text', 'image', 'audio', 'video'] as const satisfies readonly InputModality[];
const DOCUMENT_TYPE_VALUES = ['pdf'] as const satisfies readonly DocumentType[];

const isInputModality = (value: string): value is InputModality =>
    (INPUT_MODALITY_VALUES as readonly string[]).includes(value);

const isDocumentType = (value: string): value is DocumentType =>
    (DOCUMENT_TYPE_VALUES as readonly string[]).includes(value);

export type ModelCapabilities = {
    inputModalities: InputModality[];
    supportedDocumentTypes: DocumentType[];
};

/**
 * Pure lookup of a model's input capabilities in a models.dev catalog.
 * Separated from the network fetch so it can be unit-tested directly.
 *
 * Resolution is automatic from the catalog — capabilities are NOT hand-declared
 * in config.json. When a model isn't catalogued (e.g. a self-hosted /
 * openai-compatible endpoint we can't introspect), we fall back to text-only
 * with no document support: the model stays fully usable for normal chat, and
 * richer attachments stay gated off until we can positively confirm support.
 */
export const lookupModelCapabilities = (
    catalog: ModelsDevCatalog | null,
    config: Pick<LanguageModel, 'provider' | 'model'>,
): ModelCapabilities => {
    const providerId = resolveProviderId(config.provider);
    const inputs = catalog?.[providerId]?.models?.[config.model]?.modalities?.input;

    if (!inputs || inputs.length === 0) {
        return { inputModalities: ['text'], supportedDocumentTypes: [] };
    }

    const inputModalities = inputs.filter(isInputModality);
    const supportedDocumentTypes = inputs.filter(isDocumentType);

    // Every model accepts text, even if the catalog omits it from the list.
    if (!inputModalities.includes('text')) {
        inputModalities.unshift('text');
    }

    return { inputModalities, supportedDocumentTypes };
};

export const resolveModelCapabilities = async (
    config: Pick<LanguageModel, 'provider' | 'model'>,
): Promise<ModelCapabilities> => {
    const catalog = await loadCatalog();
    return lookupModelCapabilities(catalog, config);
};
