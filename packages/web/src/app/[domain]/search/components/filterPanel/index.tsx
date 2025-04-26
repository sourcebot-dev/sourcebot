'use client';

import { Repository, SearchResultFile } from "@/lib/types";
import { cn, getRepoCodeHostInfo } from "@/lib/utils";
import { SetStateAction, useCallback, useEffect, useState } from "react";
import { Entry } from "./entry";
import { Filter } from "./filter";
import Image from "next/image";
import { LaptopIcon } from "@radix-ui/react-icons";
import { FileIcon } from "@/components/ui/fileIcon";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

interface FilePanelProps {
    matches: SearchResultFile[];
    onFilterChanged: (filteredMatches: SearchResultFile[]) => void,
    repoMetadata: Record<string, Repository>;
}

const LANGUAGES_QUERY_PARAM = "langs";
const REPOS_QUERY_PARAM = "repos";

export const FilterPanel = ({
    matches,
    onFilterChanged,
    repoMetadata,
}: FilePanelProps) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Helper to parse query params into sets
    const getSelectedFromQuery = (param: string) => {
        const value = searchParams.get(param);
        return value ? new Set(value.split(',')) : new Set();
    };

    const [repos, setRepos] = useState<Record<string, Entry>>(() => {
        const selectedRepos = getSelectedFromQuery(REPOS_QUERY_PARAM);
        return aggregateMatches(
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
                    isSelected: selectedRepos.has(key),
                    Icon,
                };
            }
        );
    });

    const [languages, setLanguages] = useState<Record<string, Entry>>(() => {
        const selectedLanguages = getSelectedFromQuery(LANGUAGES_QUERY_PARAM);
        return aggregateMatches(
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
                    isSelected: selectedLanguages.has(key),
                    Icon: Icon,
                } satisfies Entry;
            }
        );
    });

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

    // Calls `onFilterChanged` with the filtered list of matches
    // whenever the filter state changes.
    useEffect(() => {
        const selectedRepos = new Set(Object.keys(repos).filter((key) => repos[key].isSelected));
        const selectedLanguages = new Set(Object.keys(languages).filter((key) => languages[key].isSelected));

        const filteredMatches = matches.filter((match) =>
        (
            (selectedRepos.size === 0 ? true : selectedRepos.has(match.Repository)) &&
            (selectedLanguages.size === 0 ? true : selectedLanguages.has(match.Language))
        )
        );
        onFilterChanged(filteredMatches);

    }, [matches, repos, languages, onFilterChanged, searchParams, router]);

    // Updates the query params when the filter state changes
    useEffect(() => {
        const selectedRepos = Object.keys(repos).filter((key) => repos[key].isSelected);
        const selectedLanguages = Object.keys(languages).filter((key) => languages[key].isSelected);

        const newParams = new URLSearchParams(searchParams.toString());

        if (selectedRepos.length > 0) {
            newParams.set(REPOS_QUERY_PARAM, selectedRepos.join(','));
        } else {
            newParams.delete(REPOS_QUERY_PARAM);
        }

        if (selectedLanguages.length > 0) {
            newParams.set(LANGUAGES_QUERY_PARAM, selectedLanguages.join(','));
        } else {
            newParams.delete(LANGUAGES_QUERY_PARAM);
        }

        // Only push if params actually changed
        if (newParams.toString() !== searchParams.toString()) {
            router.replace(`?${newParams.toString()}`, { scroll: false });
        }
    }, [repos, languages, searchParams, router]);

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
