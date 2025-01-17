'use client';

import { Repository, SearchResultFile } from "@/lib/types";
import { cn, getRepoCodeHostInfo } from "@/lib/utils";
import { SetStateAction, useCallback, useEffect, useState } from "react";
import { Entry } from "./entry";
import { Filter } from "./filter";
import Image from "next/image";
import { LaptopIcon } from "@radix-ui/react-icons";
import { FileIcon } from "@/components/ui/fileIcon";

interface FilePanelProps {
    matches: SearchResultFile[];
    onFilterChanged: (filteredMatches: SearchResultFile[]) => void,
    repoMetadata: Record<string, Repository>;
}

export const FilterPanel = ({
    matches,
    onFilterChanged,
    repoMetadata,
}: FilePanelProps) => {
    const [repos, setRepos] = useState<Record<string, Entry>>({});
    const [languages, setLanguages] = useState<Record<string, Entry>>({});

    useEffect(() => {
        const _repos = aggregateMatches(
            "Repository",
            matches,
            (key) => {
                const repo: Repository | undefined = repoMetadata[key];
                const info = getRepoCodeHostInfo(repo);
                const Icon = info ? (
                    <Image
                        src={info.icon}
                        alt={info.codeHostName}
                        className={cn('w-4 h-4 flex-shrink-0', info.iconClassName)}
                    />
                ) : (
                    <LaptopIcon className="w-4 h-4 flex-shrink-0" />
                );

                return {
                    key,
                    displayName: info?.displayName ?? key,
                    count: 0,
                    isSelected: false,
                    Icon,
                };
            }
        );

        setRepos(_repos);
    }, [matches, repoMetadata, setRepos]);

    useEffect(() => {
        const _languages = aggregateMatches(
            "Language",
            matches,
            (key) => {
                const Icon = (
                    <FileIcon language={key} />
                )

                return {
                    key,
                    displayName: key,
                    count: 0,
                    isSelected: false,
                    Icon: Icon,
                } satisfies Entry;
            }
        )

        setLanguages(_languages);
    }, [matches, setLanguages]);

    const onEntryClicked = useCallback((
        key: string,
        setter: (value: SetStateAction<Record<string, Entry>>) => void,
    ) => {
        setter((values) => ({
            ...values,
            [key]: {
                ...values[key],
                isSelected: !values[key].isSelected,
            },
        }));
    }, []);

    useEffect(() => {
        const selectedRepos = new Set(
            Object.entries(repos)
                .filter(([_, { isSelected }]) => isSelected)
                .map(([key]) => key)
        );

        const selectedLanguages = new Set(
            Object.entries(languages)
                .filter(([_, { isSelected }]) => isSelected)
                .map(([key]) => key)
        );

        const filteredMatches = matches.filter((match) =>
        (
            (selectedRepos.size === 0 ? true : selectedRepos.has(match.Repository)) &&
            (selectedLanguages.size === 0 ? true : selectedLanguages.has(match.Language))
        )
        );

        onFilterChanged(filteredMatches);
    }, [matches, repos, languages, onFilterChanged]);

    const numRepos = Object.keys(repos).length > 100 ? '100+' : Object.keys(repos).length;
    const numLanguages = Object.keys(languages).length > 100 ? '100+' : Object.keys(languages).length;
    return (
        <div className="p-3 flex flex-col gap-3 h-full">
            <Filter
                title="Filter By Repository"
                searchPlaceholder={`Filter ${numRepos} repositories`}
                entries={Object.values(repos)}
                onEntryClicked={(key) => onEntryClicked(key, setRepos)}
                className="max-h-[50%]"
            />
            <Filter
                title="Filter By Language"
                searchPlaceholder={`Filter ${numLanguages} languages`}
                entries={Object.values(languages)}
                onEntryClicked={(key) => onEntryClicked(key, setLanguages)}
                className="overflow-auto"
            />
        </div>
    )
}

/* Aggregates `matches` by the given `propName`. The result is a record 
 * of `Entry` objects, where the key is the aggregated `propName` and
 * the value is the entry created by `createEntry`. Example:
 * 
 * "repo1": {
 *  "count": 22,
 *  ...
 * },
 * "repo2": {
 *  "count": 9,
 *  ...
 * }
 */
const aggregateMatches = (
    propName: 'Repository' | 'Language',
    matches: SearchResultFile[],
    createEntry: (key: string) => Entry
) => {
    return matches
        .map((match) => match[propName])
        .filter((key) => key.length > 0)
        .reduce((aggregation, key) => {
            if (!aggregation[key]) {
                aggregation[key] = createEntry(key);
            }
            aggregation[key].count += 1;
            return aggregation;
        }, {} as Record<string, Entry>)
}
