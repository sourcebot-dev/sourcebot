'use client';

import { Input } from "@/components/ui/input";
import { SearchResultFile } from "@/lib/types";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { compareEntries, Entry } from "./entry";

interface FilePanelProps {
    matches: SearchResultFile[];
    onFilterChanged: (filteredMatches: SearchResultFile[]) => void,
}

export const FilterPanel = ({
    matches,
    onFilterChanged,
}: FilePanelProps) => {
    const [repos, setRepos] = useState<Record<string, Entry>>({});

    useEffect(() => {
        const _repos = matches
            .map((fileMatch) => fileMatch.Repository)
            .reduce((repos, repoId) => {
                if (!repos[repoId]) {
                    const info = getRepoCodeHostInfo(repoId);
                    repos[repoId] = {
                        displayName: info?.repoName ?? repoId,
                        count: 0,
                        isSelected: false,
                        icon: info?.icon,
                        iconAltText: info?.costHostName,
                        iconClassName: info?.iconClassName,
                    };
                }
                repos[repoId].count += 1;
                return repos;
            }, {} as Record<string, Entry>);
        
        setRepos(_repos);
    }, [matches, setRepos]);

    const onEntryClicked = useCallback((name: string) => {
        setRepos((repos) => ({
            ...repos,
            [name]: {
                ...repos[name],
                isSelected: !repos[name].isSelected,
            },
        }));
    }, []);

    const filteredMatches = useMemo(() => {
        const selectedRepos = new Set(
            Object.entries(repos)
                .filter(([_, { isSelected }]) => isSelected)
                .map(([name]) => name)
        );

        if (selectedRepos.size === 0) {
            return matches;
        }

        return matches.filter((match) => {
            return selectedRepos.has(match.Repository);
        });
    }, [matches, repos]);

    useEffect(() => {
        onFilterChanged(filteredMatches);
    }, [filteredMatches]);

    return (
        <div className="p-3 flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Filter Results</h1>

            {/* Repos filter */}
            <div className="flex flex-col gap-2 p-1">
                <h2 className="text-md">By Repository</h2>
                <Input
                    placeholder="Filter repositories"
                    className="h-8"
                />

                <div className="flex flex-col gap-0.5 text-sm">
                    {Object.entries(repos)
                        .sort(([_, entryA], [__, entryB]) => compareEntries(entryB, entryA))
                        .map(([name, entry]) => (
                            <Entry
                                entry={entry}
                                onClicked={() => onEntryClicked(name) }
                            />
                        ))}
                </div>
            </div>
        </div>
    )
}
