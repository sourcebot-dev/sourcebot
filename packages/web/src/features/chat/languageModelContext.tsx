'use client';

import { createContext, useMemo, type ReactNode } from "react";
import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";

export interface SelectedLanguageModelContextValue {
    storedLanguageModel: LanguageModelInfo | undefined;
    setSelectedLanguageModel: (model: LanguageModelInfo | undefined) => void;
}

export const SelectedLanguageModelContext = createContext<SelectedLanguageModelContextValue | null>(null);

interface LanguageModelProviderProps {
    children: ReactNode;
}

// Single owner of the persisted model preference, mounted in the (app) layout.
// It must not hold the configured model list: layouts do not re-render on
// client-side navigation, so that list would go stale after a config change.
// `useSelectedLanguageModel` resolves the preference against the page's list.
export const LanguageModelProvider = ({
    children,
}: LanguageModelProviderProps) => {
    const [storedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>(
        "selectedLanguageModel",
        undefined,
        {
            initializeWithValue: false,
        }
    );

    const value = useMemo<SelectedLanguageModelContextValue>(() => ({
        storedLanguageModel,
        setSelectedLanguageModel,
    }), [storedLanguageModel, setSelectedLanguageModel]);

    return (
        <SelectedLanguageModelContext.Provider value={value}>
            {children}
        </SelectedLanguageModelContext.Provider>
    );
};
