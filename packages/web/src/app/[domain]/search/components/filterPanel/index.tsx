'use client';

import { FileIcon } from "@/components/ui/fileIcon";
import { RepositoryInfo, SearchResultFile } from "@/features/search/types";
import { cn, getCodeHostInfoForRepo } from "@/lib/utils";
import { LaptopIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Entry } from "./entry";
import { Filter } from "./filter";
import { LANGUAGES_QUERY_PARAM, REPOS_QUERY_PARAM, useFilteredMatches } from "./useFilterMatches";
import { useGetSelectedFromQuery } from "./useGetSelectedFromQuery";
import { RepositoryName } from "@/components/ui/repositoryName";

interface FilePanelProps {
    matches: SearchResultFile[];
    repoInfo: Record<number, RepositoryInfo>;
}

/**
 * FilterPanel Component
 * 
 * A bidirectional filtering component that allows users to filter search results by repository and language.
 * The filtering is bidirectional, meaning:
 * 1. When repositories are selected, the language filter will only show languages that exist in those repositories
 * 2. When languages are selected, the repository filter will only show repositories that contain those languages
 * 
 * This prevents users from selecting filter combinations that would yield no results. For example:
 * - If Repository A only contains Python and JavaScript files, selecting it will only enable these languages
 * - If Language Python is selected, only repositories containing Python files will be enabled
 * 
 * @param matches - Array of search result files to filter
 * @param repoInfo - Information about repositories including their display names and icons
 */
export const FilterPanel = ({
    matches,
    repoInfo,
}: FilePanelProps) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const { getSelectedFromQuery } = useGetSelectedFromQuery();
    const matchesFilteredByRepository = useFilteredMatches(matches, 'repository');
    const matchesFilteredByLanguage = useFilteredMatches(matches, 'language');

    const repos = useMemo(() => {
        const selectedRepos = getSelectedFromQuery(REPOS_QUERY_PARAM);
        return aggregateMatches(
            "repository",
            matches,
            /* createEntry = */ ({ key: repository, match }) => {
                const repo: RepositoryInfo | undefined = repoInfo[match.repositoryId];

                const info = repo ? getCodeHostInfoForRepo({
                    name: repo.name,
                    codeHostType: repo.codeHostType,
                    displayName: repo.displayName,
                    webUrl: repo.webUrl,
                }) : undefined;

                const Icon = info ? (
                    <Image
                        src={info.icon}
                        alt={info.codeHostName}
                        className={cn('w-4 h-4 flex-shrink-0', info.iconClassName)}
                    />
                ) : (
                    <LaptopIcon className="w-4 h-4 flex-shrink-0" />
                );

                const isSelected = selectedRepos.has(repository);

                // If the matches filtered by language don't contain this repository, then this entry is disabled
                const isDisabled = !matchesFilteredByLanguage.some((match) => match.repository === repository);
                const isHidden = isDisabled && !isSelected;

                return {
                    key: repository,
                    displayName: (
                        <RepositoryName 
                            repoName={info?.displayName ?? repository}
                            displayMode="truncate"
                            maxLength={50}
                            tooltipSide="right"
                            className="flex-1 min-w-0"
                        />
                    ),
                    count: 0,
                    isSelected,
                    isDisabled,
                    isHidden,
                    Icon,
                };
            },
            /* shouldCount = */ ({ match }) => {
                return matchesFilteredByLanguage.some((value) => value.language === match.language)
            }
        )
    }, [getSelectedFromQuery, matches, repoInfo, matchesFilteredByLanguage]);

    const languages = useMemo(() => {
        const selectedLanguages = getSelectedFromQuery(LANGUAGES_QUERY_PARAM);
        return aggregateMatches(
            "language",
            matches,
            /* createEntry = */ ({ key: language }) => {
                const Icon = (
                    <FileIcon language={language} />
                )

                const isSelected = selectedLanguages.has(language);

                // If the matches filtered by repository don't contain this language, then this entry is disabled
                const isDisabled = !matchesFilteredByRepository.some((match) => match.language === language);
                const isHidden = isDisabled && !isSelected;

                return {
                    key: language,
                    displayName: language,
                    count: 0,
                    isSelected,
                    isDisabled,
                    isHidden,
                    Icon: Icon,
                } satisfies Entry;
            },
            /* shouldCount = */ ({ match }) => {
                return matchesFilteredByRepository.some((value) => value.repository === match.repository)
            }
        );
    }, [getSelectedFromQuery, matches, matchesFilteredByRepository]);

    const visibleRepos = useMemo(() => Object.values(repos).filter((entry) => !entry.isHidden), [repos]);
    const visibleLanguages = useMemo(() => Object.values(languages).filter((entry) => !entry.isHidden), [languages]);

    const numRepos = useMemo(() => visibleRepos.length > 100 ? '100+' : visibleRepos.length, [visibleRepos]);
    const numLanguages = useMemo(() => visibleLanguages.length > 100 ? '100+' : visibleLanguages.length, [visibleLanguages]);

    return (
        <div className="p-3 flex flex-col gap-3 h-full">
            <Filter
                title="Filter By Repository"
                searchPlaceholder={`Filter ${numRepos} repositories`}
                entries={visibleRepos}
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
                entries={visibleLanguages}
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
    createEntry: (props: { key: string, match: SearchResultFile }) => Entry,
    shouldCount: (props: { key: string, match: SearchResultFile }) => boolean,
) => {
    return matches
        .map((match) => ({ key: match[propName], match }))
        .filter(({ key }) => key.length > 0)
        .reduce((aggregation, { key, match }) => {
            if (!aggregation[key]) {
                aggregation[key] = createEntry({ key, match });
            }

            if (!aggregation[key].isDisabled && shouldCount({ key, match })) {
                aggregation[key].count += 1;
            }

            return aggregation;
        }, {} as Record<string, Entry>)
}
