'use client';

import { createContext, useEffect, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";
import { getLanguageModelKey } from "./utils";

export interface SelectedLanguageModelContextValue {
    languageModels: LanguageModelInfo[];
    selectedLanguageModel: LanguageModelInfo | undefined;
    setSelectedLanguageModel: (model: LanguageModelInfo | undefined) => void;
}

export const SelectedLanguageModelContext = createContext<SelectedLanguageModelContextValue | null>(null);

interface LanguageModelProviderProps {
    languageModels: LanguageModelInfo[];
    children: ReactNode;
}

// Single owner of the selected-language-model state. Mounted once (in the (app)
// layout), so the selection lives in one place instead of being re-derived by a
// `useSelectedLanguageModel` hook in every consumer. Previously each consumer
// ran its own reset effect against the shared "selectedLanguageModel"
// localStorage key, and because usehooks-ts broadcasts a storage event on every
// write, those instances re-triggered each other into a rapid write loop when a
// model was removed.
export const LanguageModelProvider = ({
    languageModels,
    children,
}: LanguageModelProviderProps) => {
    const fallbackLanguageModel = languageModels.length > 0 ? languageModels[0] : undefined;
    const [selectedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>(
        "selectedLanguageModel",
        fallbackLanguageModel,
        {
            initializeWithValue: false,
        }
    );

    // Handle the case where the selected language model is no longer available.
    // Reset to the fallback language model in this case. Only write when the
    // resolved selection actually differs (compared by key, since the stored
    // value is a fresh object reference on every read) — otherwise the effect
    // would re-write on every render.
    useEffect(() => {
        const selectedKey = selectedLanguageModel
            ? getLanguageModelKey(selectedLanguageModel)
            : undefined;

        const isSelectedModelAvailable = selectedKey !== undefined && languageModels.some(
            (model) => getLanguageModelKey(model) === selectedKey
        );

        if (isSelectedModelAvailable) {
            return;
        }

        const fallbackKey = fallbackLanguageModel
            ? getLanguageModelKey(fallbackLanguageModel)
            : undefined;

        if (fallbackKey !== selectedKey) {
            setSelectedLanguageModel(fallbackLanguageModel);
        }
    }, [
        fallbackLanguageModel,
        languageModels,
        selectedLanguageModel,
        setSelectedLanguageModel,
    ]);

    const value = useMemo<SelectedLanguageModelContextValue>(() => ({
        languageModels,
        selectedLanguageModel,
        setSelectedLanguageModel,
    }), [languageModels, selectedLanguageModel, setSelectedLanguageModel]);

    return (
        <SelectedLanguageModelContext.Provider value={value}>
            {children}
        </SelectedLanguageModelContext.Provider>
    );
};
