'use client';

import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";
import { useEffect } from "react";
import { getLanguageModelKey } from "./utils";

type Props = {
    languageModels: LanguageModelInfo[];
}

const getStoredSelectedLanguageModel = (): LanguageModelInfo | undefined => {
    try {
        const storedValue = window.localStorage.getItem("selectedLanguageModel");
        if (!storedValue) {
            return undefined;
        }

        const parsedValue = JSON.parse(storedValue);
        if (
            typeof parsedValue === "object" &&
            parsedValue !== null &&
            typeof parsedValue.provider === "string" &&
            typeof parsedValue.model === "string" &&
            typeof parsedValue.displayName === "string"
        ) {
            return parsedValue as LanguageModelInfo;
        }

        return undefined;
    } catch {
        return undefined;
    }
};

export const useSelectedLanguageModel = ({
    languageModels,
}: Props) => {
    const fallbackLanguageModel = languageModels.length > 0 ? languageModels[0] : undefined;
    const [selectedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>(
        "selectedLanguageModel",
        undefined,
        {
            initializeWithValue: false,
        }
    );

    const availableSelectedLanguageModel = selectedLanguageModel && languageModels.find(
        (model) => getLanguageModelKey(model) === getLanguageModelKey(selectedLanguageModel)
    );

    const resolvedSelectedLanguageModel = availableSelectedLanguageModel ?? fallbackLanguageModel;

    // Handle the case where the selected language model is no longer
    // available. Reset to the fallback language model in this case.
    useEffect(() => {
        if (languageModels.length === 0) {
            return;
        }

        if (selectedLanguageModel && !availableSelectedLanguageModel) {
            setSelectedLanguageModel(() => {
                const storedSelectedLanguageModel = getStoredSelectedLanguageModel();
                const availableStoredSelectedLanguageModel = storedSelectedLanguageModel && languageModels.find(
                    (model) => getLanguageModelKey(model) === getLanguageModelKey(storedSelectedLanguageModel)
                );

                if (availableStoredSelectedLanguageModel) {
                    return availableStoredSelectedLanguageModel;
                }

                return fallbackLanguageModel;
            });
        }
    }, [
        availableSelectedLanguageModel,
        fallbackLanguageModel,
        languageModels,
        selectedLanguageModel,
        setSelectedLanguageModel,
    ]);

    return {
        selectedLanguageModel,
        resolvedSelectedLanguageModel,
        setSelectedLanguageModel,
    };
}
