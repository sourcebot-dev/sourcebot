import type { SuggestionMode } from "./types";

export const shouldUsePlainComposerEnterBehavior = (
    suggestionMode: SuggestionMode,
    suggestionCount: number,
) => suggestionMode === "none" || (suggestionMode === "command" && suggestionCount === 0);
