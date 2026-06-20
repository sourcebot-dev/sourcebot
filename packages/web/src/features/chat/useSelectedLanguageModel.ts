'use client';

import { useContext } from "react";
import { SelectedLanguageModelContext } from "./languageModelContext";

export const useSelectedLanguageModel = () => {
    const context = useContext(SelectedLanguageModelContext);
    if (!context) {
        throw new Error("useSelectedLanguageModel must be used within a LanguageModelProvider");
    }

    const { selectedLanguageModel, setSelectedLanguageModel } = context;
    return {
        selectedLanguageModel,
        setSelectedLanguageModel,
    };
};
