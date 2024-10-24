'use client';

import { SearchResultFile } from "@/lib/types";
import { getRepoCodeHostInfo } from "@/lib/utils";
import { SetStateAction, useCallback, useEffect, useState } from "react";
import { Entry } from "./entry";
import { Filter } from "./filter";
import { getLanguageIcon } from "./languageIcons";

interface FilePanelProps {
    matches: SearchResultFile[];
    onFilterChanged: (filteredMatches: SearchResultFile[]) => void,
}

export const FilterPanel = ({
    matches,
    onFilterChanged,
}: FilePanelProps) => {
    const [repos, setRepos] = useState<Record<string, Entry>>({});
    const [languages, setLanguages] = useState<Record<string, Entry>>({});

    useEffect(() => {
        const _repos = aggregateMatches(
            "Repository",
            matches,
            (key) => {
                const info = getRepoCodeHostInfo(key);
                return {
                    displayName: info?.repoName ?? key,
                    count: 0,
                    isSelected: false,
                    icon: info?.icon,
                    iconAltText: info?.costHostName,
                    iconClassName: info?.iconClassName,
                };
            }
        );
       
        setRepos(_repos);
    }, [matches, setRepos]);

    useEffect(() => {
        const _languages = aggregateMatches(
            "Language",
            matches,
            (key) => {
                // @todo: Get language icons
                return {
                    displayName: key,
                    count: 0,
                    isSelected: false,
                    icon: getLanguageIcon(key),
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
    }, [matches, repos, languages]);

    return (
        <div className="p-3 flex flex-col gap-3">
            <h1 className="text-lg font-semibold">Filter Results</h1>

            <Filter
                title="By Repository"
                searchPlaceholder="Filter repositories"
                entries={repos}
                onEntryClicked={(key) => onEntryClicked(key, setRepos)}
            />

            <Filter
                title="By Language"
                searchPlaceholder="Filter languages"
                entries={languages}
                onEntryClicked={(key) => onEntryClicked(key, setLanguages)}
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