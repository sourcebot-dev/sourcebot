'use client';

import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";

export const useSelectedLanguageModel = () => {
    const [selectedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>("selectedLanguageModel", undefined, {
        initializeWithValue: false,
    });

    return {
        selectedLanguageModel,
        setSelectedLanguageModel,
    };
}