'use client';

import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";
import { useEffect } from "react";
import { getLanguageModelKey } from "./utils";

type Props = {
    languageModels: LanguageModelInfo[];
}

export const useSelectedLanguageModel = ({
    languageModels,
}: Props) => {
    const fallbackLanguageModel = languageModels.length > 0 ? languageModels[0] : undefined;
    const [selectedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>(
        "selectedLanguageModel",
        fallbackLanguageModel,
        {
            initializeWithValue: false,
        }
    );

    // Handle the case where the selected language model is no longer
    // available. Reset to the fallback language model in this case.
    useEffect(() => {
        if (!selectedLanguageModel || !languageModels.find(
            (model) => getLanguageModelKey(model) === getLanguageModelKey(selectedLanguageModel)
        )) {
            setSelectedLanguageModel(fallbackLanguageModel);
        }
    }, [
        fallbackLanguageModel,
        languageModels,
        selectedLanguageModel,
        setSelectedLanguageModel,
    ]);

    return {
        selectedLanguageModel,
        setSelectedLanguageModel,
    };
}