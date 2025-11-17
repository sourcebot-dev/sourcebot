'use client';

import { useQuery } from "@tanstack/react-query";
import { FileSuggestion, RefineSuggestion, Suggestion, SuggestionMode } from "./types";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { search } from "@/app/api/(client)/client";
import { useMemo } from "react";

interface Props {
    suggestionMode: SuggestionMode;
    suggestionQuery: string;
    selectedRepos: string[];
}

const refineSuggestions: RefineSuggestion[] = [
    {
        type: 'refine',
        targetSuggestionMode: 'file',
        name: 'Files',
        description: 'Include a file in the agent\'s context window.',
    }
]

export const useSuggestionsData = ({
    suggestionMode,
    suggestionQuery,
    selectedRepos,
}: Props): { isLoading: boolean, suggestions: Suggestion[] } => {
    const domain = useDomain();

    const { data: fileSuggestions, isLoading: _isLoadingFileSuggestions } = useQuery({
        queryKey: ["fileSuggestions-agentic", suggestionQuery, domain, selectedRepos],
        queryFn: () => {
            let query = `file:${suggestionQuery}`;
            if (selectedRepos.length > 0) {
                query += ` reposet:${selectedRepos.join(',')}`;
            }

            return unwrapServiceError(search({
                query,
                matches: 10,
                contextLines: 1,
            }))
        },
        select: (data): FileSuggestion[] => {
            return data.files.map((file) => {
                const path = file.fileName.text;
                const suggestion: FileSuggestion = {
                    type: 'file',
                    path,
                    repo: file.repository,
                    name: path.split('/').pop() ?? '',
                    language: file.language,
                    revision: 'HEAD', // @todo: make revision configurable.
                }

                return suggestion;
            });
        },
        enabled: suggestionMode === "file",
    });
    const isLoadingFiles = useMemo(() => suggestionMode === "file" && _isLoadingFileSuggestions, [_isLoadingFileSuggestions, suggestionMode]);

    switch (suggestionMode) {
        case 'file':
            return {
                suggestions: fileSuggestions ?? [],
                isLoading: isLoadingFiles,
            }
        case 'refine':
            return {
                suggestions: refineSuggestions,
                isLoading: false,
            }
        default:
            return {
                isLoading: false,
                suggestions: [],
            }
    }
}