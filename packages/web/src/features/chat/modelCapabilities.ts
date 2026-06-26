import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { DocumentType, InputModality } from './types';

// Fail-closed: when a model does not declare input modalities, assume text-only.
// NOTE: future work may add live provider capability probing (see
// tryResolveAnthropicThinkingConfig in llm.server.ts for the precedent).
export const resolveModelInputModalities = (config: LanguageModel): InputModality[] => {
    const declared = config.inputModalities;
    if (declared && declared.length > 0) {
        return declared;
    }
    return ['text'];
}

// Fail-closed: when a model does not declare supported document types, assume none.
// Document types (e.g. PDF) are container formats distinct from raw input
// modalities, since providers decompose them into text/image internally.
export const resolveModelSupportedDocumentTypes = (config: LanguageModel): DocumentType[] => {
    const declared = config.supportedDocumentTypes;
    if (declared && declared.length > 0) {
        return declared;
    }
    return [];
}
