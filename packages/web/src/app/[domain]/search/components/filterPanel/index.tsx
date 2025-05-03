'use client';

import { FileIcon } from "@/components/ui/fileIcon";
import { Repository, SearchResultFile } from "@/features/search/types";
import { cn, getRepoCodeHostInfo } from "@/lib/utils";
import { LaptopIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { Entry } from "./entry";
import { Filter } from "./filter";

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
    const getSelectedFromQuery = useCallback((param: string) => {
        const value = searchParams.get(param);
        return value ? new Set(value.split(',')) : new Set();
    }, [searchParams]);

    const repos = useMemo(() => {
        const selectedRepos = getSelectedFromQuery(REPOS_QUERY_PARAM);
        return aggregateMatches(
            "repository",
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
        )
    }, [getSelectedFromQuery, matches, repoMetadata]);

    const languages = useMemo(() => {
        const selectedLanguages = getSelectedFromQuery(LANGUAGES_QUERY_PARAM);
        return aggregateMatches(
            "language",
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
    }, [getSelectedFromQuery, matches]);

    // Calls `onFilterChanged` with the filtered list of matches
    // whenever the filter state changes.
    useEffect(() => {
        const selectedRepos = new Set(Object.keys(repos).filter((key) => repos[key].isSelected));
        const selectedLanguages = new Set(Object.keys(languages).filter((key) => languages[key].isSelected));

        const filteredMatches = matches.filter((match) =>
        (
            (selectedRepos.size === 0 ? true : selectedRepos.has(match.repository)) &&
            (selectedLanguages.size === 0 ? true : selectedLanguages.has(match.language))
        )
        );
        onFilterChanged(filteredMatches);

    }, [matches, repos, languages, onFilterChanged, searchParams, router]);

    const numRepos = useMemo(() => Object.keys(repos).length > 100 ? '100+' : Object.keys(repos).length, [repos]);
    const numLanguages = useMemo(() => Object.keys(languages).length > 100 ? '100+' : Object.keys(languages).length, [languages]);

    return (
        <div className="p-3 flex flex-col gap-3 h-full">
            <Filter
                title="Filter By Repository"
                searchPlaceholder={`Filter ${numRepos} repositories`}
                entries={Object.values(repos)}
                onEntryClicked={(key) => {
                    const newRepos = { ...repos };
                    newRepos[key].isSelected = !newRepos[key].isSelected;
                    const selectedRepos = Object.keys(newRepos).filter((key) => newRepos[key].isSelected);
                    const newParams = new URLSearchParams(searchParams.toString());

                    if (selectedRepos.length > 0) {
                        newParams.set(REPOS_QUERY_PARAM, selectedRepos.join(','));
                    } else {
                        newParams.delete(REPOS_QUERY_PARAM);
                    }

                    if (newParams.toString() !== searchParams.toString()) {
                        router.replace(`?${newParams.toString()}`, { scroll: false });
                    }
                }}
                className="max-h-[50%]"
            />
            <Filter
                title="Filter By Language"
                searchPlaceholder={`Filter ${numLanguages} languages`}
                entries={Object.values(languages)}
                onEntryClicked={(key) => {
                    const newLanguages = { ...languages };
                    newLanguages[key].isSelected = !newLanguages[key].isSelected;
                    const selectedLanguages = Object.keys(newLanguages).filter((key) => newLanguages[key].isSelected);
                    const newParams = new URLSearchParams(searchParams.toString());

                    if (selectedLanguages.length > 0) {
                        newParams.set(LANGUAGES_QUERY_PARAM, selectedLanguages.join(','));
                    } else {
                        newParams.delete(LANGUAGES_QUERY_PARAM);
                    }

                    if (newParams.toString() !== searchParams.toString()) {
                        router.replace(`?${newParams.toString()}`, { scroll: false });
                    }
                }}
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
    propName: 'repository' | 'language',
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
