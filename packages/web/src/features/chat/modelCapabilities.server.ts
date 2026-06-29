import 'server-only';

import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { DocumentType, InputModality, LanguageModelProvider } from './types';
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

// A model supporting a document type (per the catalog) is necessary but not
// sufficient: the AI SDK provider adapter we route through must also be able to
// translate that document into a `file` part for the wire. Several adapters
// either only handle images (e.g. amazon-bedrock) or are back-end/version
// dependent (openai-compatible, openrouter, xai), and will throw
// `AI_UnsupportedFunctionalityError: 'file part media type application/pdf'` at
// stream time even when the model itself accepts PDFs. We therefore intersect
// the catalog's document support with this fail-closed allowlist of providers
// whose adapter is known to carry PDF file parts. Anything not listed drops
// PDF rather than risking a hard turn failure.
//
// @note Verify against the bundled `@ai-sdk/*` versions before adding a
// provider here. `azure` routes through the OpenAI responses path (input_file)
// so it is included; `xai`/`openrouter`/`amazon-bedrock` are intentionally
// omitted pending confirmation in their adapter versions.
const PDF_DOCUMENT_PROVIDERS: ReadonlySet<LanguageModelProvider> = new Set([
    'anthropic',
    'openai',
    'azure',
    'google-generative-ai',
    'google-vertex',
    'google-vertex-anthropic',
]);

/**
 * Whether the AI SDK adapter for `provider` can carry an `application/pdf` file
 * part. Fail-closed: providers not on the allowlist resolve to no PDF support.
 */
export const providerSupportsPdfDocuments = (provider: LanguageModelProvider): boolean =>
    PDF_DOCUMENT_PROVIDERS.has(provider);

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
    // Narrow the catalog's document support to what the provider's adapter can
    // actually send on the wire (see PDF_DOCUMENT_PROVIDERS): a model may accept
    // PDFs while the adapter cannot carry the file part.
    const supportedDocumentTypes = inputs
        .filter(isDocumentType)
        .filter((documentType) =>
            documentType === 'pdf' ? providerSupportsPdfDocuments(config.provider) : true);

    // Every model accepts text, even if the catalog omits it from the list.
    if (!inputModalities.includes('text')) {
        inputModalities.unshift('text');
    }

    return { inputModalities, supportedDocumentTypes };
};

export const resolveModelCapabilities = async (
    config: Pick<LanguageModel, 'provider' | 'model'>,
): Promise<ModelCapabilities> => {
    // Block on the first (cold) fetch so capabilities resolve correctly instead
    // of degrading to text-only right after start. Bounded/one-time (see loadCatalog).
    const catalog = await loadCatalog({ awaitWhenEmpty: true });
    return lookupModelCapabilities(catalog, config);
};
