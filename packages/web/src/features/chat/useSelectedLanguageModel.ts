'use client';

import { useContext, useMemo } from "react";
import { SelectedLanguageModelContext } from "./languageModelContext";
import { LanguageModelInfo } from "./types";
import { getLanguageModelKey } from "./utils";

// Returns the list's own entry rather than the stored copy so capabilities
// reflect the current config. Unavailable selections fall back without writing
// to storage, so multiple consumers cannot trigger each other into a write loop.
export const useSelectedLanguageModel = (languageModels: LanguageModelInfo[]) => {
    const context = useContext(SelectedLanguageModelContext);
    if (!context) {
        throw new Error("useSelectedLanguageModel must be used within a LanguageModelProvider");
    }

    const { storedLanguageModel, setSelectedLanguageModel } = context;

    const selectedLanguageModel = useMemo(() => {
        if (storedLanguageModel) {
            const storedKey = getLanguageModelKey(storedLanguageModel);
            const match = languageModels.find((model) => getLanguageModelKey(model) === storedKey);
            if (match) {
                return match;
            }
        }

        return languageModels.length > 0 ? languageModels[0] : undefined;
    }, [storedLanguageModel, languageModels]);

    return {
        selectedLanguageModel,
        setSelectedLanguageModel,
    };
};
