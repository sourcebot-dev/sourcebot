'use client';

import { LanguageDescription } from "@codemirror/language";
import { useMemo } from "react";
import { languages as builtinLanguages } from '@codemirror/language-data'

interface UseFindLanguageDescriptionProps {
    languageName: string;
    fuzzyMatch?: boolean;
}

export const useFindLanguageDescription = ({ languageName, fuzzyMatch = true }: UseFindLanguageDescriptionProps) => {
    const languageDescription = useMemo(() => {
        const description = LanguageDescription.matchLanguageName(
            builtinLanguages,
            languageName,
            fuzzyMatch
        );
        return description;
    }, [languageName, fuzzyMatch]);

    return languageDescription;
}