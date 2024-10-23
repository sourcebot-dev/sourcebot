'use client';

import { Input } from "@/components/ui/input";
import { SearchResultFile } from "@/lib/types";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { compareEntries, Entry } from "./entry";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FilePanelProps {
    matches: SearchResultFile[];
    onFilterChanged: (filteredMatches: SearchResultFile[]) => void,
}

export const FilterPanel = ({
    matches,
    onFilterChanged,
}: FilePanelProps) => {
    const [repos, setRepos] = useState<Record<string, Entry>>({});
    const [searchFilter, setSearchFilter] = useState<string>("");

    useEffect(() => {
        const _repos = matches
            .map((fileMatch) => fileMatch['Repository'])
            .reduce((repos, key) => {
                if (!repos[key]) {
                    const info = getRepoCodeHostInfo(key);
                    repos[key] = {
                        displayName: info?.repoName ?? key,
                        count: 0,
                        isSelected: false,
                        icon: info?.icon,
                        iconAltText: info?.costHostName,
                        iconClassName: info?.iconClassName,
                    };
                }
                repos[key].count += 1;
                return repos;
            }, {} as Record<string, Entry>);
        
        setRepos(_repos);
    }, [matches, setRepos]);

    const onEntryClicked = useCallback((key: string) => {
        setRepos((repos) => ({
            ...repos,
            [key]: {
                ...repos[key],
                isSelected: !repos[key].isSelected,
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
                <h2 className="text-sm font-semibold">By Repository</h2>
                <Input
                    placeholder="Filter repositories"
                    className="h-8"
                    onChange={(event) => setSearchFilter(event.target.value)}
                />

                <ScrollArea
                    className="overflow-hidden"
                >
                    <div
                        className="flex flex-col gap-0.5 text-sm h-full max-h-80 px-0.5"
                    >
                        {Object.entries(repos)
                            .sort(([_, entryA], [__, entryB]) => compareEntries(entryB, entryA))
                            // @todo: replace with fuzzy find
                            .filter(([_, { displayName }]) => displayName.startsWith(searchFilter))
                            .map(([key, entry]) => (
                                <Entry
                                    entry={entry}
                                    onClicked={() => onEntryClicked(key) }
                                />
                            ))}
                    </div>
                </ScrollArea>
            </div>
        </div>
    )
}