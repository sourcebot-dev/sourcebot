'use client';

import { useQuery } from "@tanstack/react-query";
import { FileSuggestion, RefineSuggestion, RepoSuggestion, Suggestion, SuggestionMode } from "./types";
import { useDomain } from "@/hooks/useDomain";
import { unwrapServiceError } from "@/lib/utils";
import { search } from "@/app/api/(client)/client";
import { useMemo } from "react";
import Fuse from "fuse.js";
import { getRepos } from "@/actions";
import { useRepoMentions } from "../../useRepoMentions";


interface Props {
    suggestionMode: SuggestionMode;
    suggestionQuery: string;
}

const refineSuggestions: RefineSuggestion[] = [
    {
        type: 'refine',
        targetSuggestionMode: 'file',
        name: 'Files',
        description: 'Include a file in the agent\'s context window.',
    },
    {
        type: 'refine',
        targetSuggestionMode: 'repo',
        name: 'Repos',
        description: 'Scope the agent to a specific repo.',
    }
]

export const useSuggestionsData = ({
    suggestionMode,
    suggestionQuery,
}: Props): { isLoading: boolean, suggestions: Suggestion[] } => {
    const domain = useDomain();
    const selectedRepos = useRepoMentions();

    const { data: fileSuggestions, isLoading: _isLoadingFileSuggestions } = useQuery({
        queryKey: ["fileSuggestions-agentic", suggestionQuery, domain, selectedRepos],
        queryFn: () => {
            let query = `file:${suggestionQuery}`;
            if (selectedRepos.length > 0) {
                query += ` reposet:${selectedRepos.map((repo) => repo.name).join(',')}`;
            }

            return unwrapServiceError(search({
                query,
                matches: 10,
                contextLines: 1,
            }, domain))
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

    const { data: _repoSuggestions, isLoading: _isLoadingRepos } = useQuery({
        queryKey: ["repoSuggestions-agentic", domain],
        queryFn: () => unwrapServiceError(getRepos(domain)),
        select: (data): RepoSuggestion[] => {
            return data.map((repo) => {
                const suggestion: RepoSuggestion = {
                    type: 'repo',
                    name: repo.repoName,
                    displayName: repo.repoDisplayName,
                    codeHostType: repo.codeHostType,
                }

                return suggestion;
            })
        },
        enabled: suggestionMode === "repo",
    });
    const isLoadingRepos = useMemo(() => suggestionMode === "repo" && _isLoadingRepos, [_isLoadingRepos, suggestionMode]);

    // client side filtering of repo suggestions.
    const repoSuggestions = useMemo(() => {
        if (suggestionMode !== "repo" || !_repoSuggestions) {
            return [];
        }

        if (suggestionQuery.length === 0) {
            return _repoSuggestions.slice(0, 10);
        }

        const fuse = new Fuse(_repoSuggestions, {
            threshold: 0.3,
            keys: ['name'],
        });

        const suggestions = fuse.search(suggestionQuery, {
            limit: 10,
        }).map(result => result.item);

        return suggestions;
    }, [_repoSuggestions, suggestionMode, suggestionQuery]);

    switch (suggestionMode) {
        case 'file':
            return {
                suggestions: fileSuggestions ?? [],
                isLoading: isLoadingFiles,
            }
        case 'repo':
            return {
                suggestions: repoSuggestions ?? [],
                isLoading: isLoadingRepos,
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