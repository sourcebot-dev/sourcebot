import { LanguageModel } from '@sourcebot/schemas/v3/languageModel.type';
import { InputModality } from './types';

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
