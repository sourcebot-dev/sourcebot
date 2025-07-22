'use client';

import { useLocalStorage } from "usehooks-ts";
import { LanguageModelInfo } from "./types";

type Props = {
    initialLanguageModel?: LanguageModelInfo;
}

export const useSelectedLanguageModel = ({
    initialLanguageModel,
}: Props = {}) => {
    const [selectedLanguageModel, setSelectedLanguageModel] = useLocalStorage<LanguageModelInfo | undefined>(
        "selectedLanguageModel",
        initialLanguageModel,
        {
            initializeWithValue: false,
        }
    );

    return {
        selectedLanguageModel,
        setSelectedLanguageModel,
    };
}