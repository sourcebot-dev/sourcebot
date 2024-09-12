'use client';

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { SearchResultFile } from "@/lib/schemas";
import { createPathWithQueryParams, getCodeHostFilePreviewLink } from "@/lib/utils";
import { SymbolIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import logoDark from "../../../public/sb_logo_dark.png";
import logoLight from "../../../public/sb_logo_light.png";
import { fetchFileSource, search } from "../api/(client)/client";
import { SearchBar } from "../searchBar";
import { SettingsDropdown } from "../settingsDropdown";
import { CodePreviewFile, CodePreviewPanel } from "./codePreviewPanel";
import { SearchResultsPanel } from "./searchResultsPanel";

const DEFAULT_NUM_RESULTS = 100;

export default function SearchPage() {
    const router = useRouter();
    const searchQuery = useNonEmptyQueryParam("query") ?? "";
    const _numResults = parseInt(useNonEmptyQueryParam("numResults") ?? `${DEFAULT_NUM_RESULTS}`);
    const isSemanticSearchEnabled = useNonEmptyQueryParam("semantic") === "true";
    const numResults = isNaN(_numResults) ? DEFAULT_NUM_RESULTS : _numResults;

    const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
    const [selectedFile, setSelectedFile] = useState<SearchResultFile | undefined>(undefined);

    const { data: searchResponse, isLoading } = useQuery({
        queryKey: ["search", searchQuery, numResults],
        queryFn: () => search({
            query: searchQuery,
            numResults,
            semantic: isSemanticSearchEnabled,
        }),
        enabled: searchQuery.length > 0,
    });

    const { fileMatches, searchDurationMs } = useMemo((): { fileMatches: SearchResultFile[], searchDurationMs: number } => {
        if (!searchResponse) {
            return {
                fileMatches: [],
                searchDurationMs: 0,
            };
        }

        return {
            fileMatches: searchResponse.Result.Files ?? [],
            searchDurationMs: Math.round(searchResponse.Result.Duration / 1000000),
        }
    }, [searchResponse]);

    const isMoreResultsButtonVisible = useMemo(() => {
        return searchResponse && searchResponse.Result.MatchCount > numResults;
    }, [searchResponse, numResults]);

    return (
        <div className="flex flex-col h-screen overflow-clip">
            {/* TopBar */}
            <div className="sticky top-0 left-0 right-0 z-10">
                <div className="flex flex-row justify-between items-center py-1.5 px-3 gap-4">
                    <div className="grow flex flex-row gap-4 items-center">
                        <div
                            className="cursor-pointer"
                            onClick={() => {
                                router.push("/");
                            }}
                        >
                            <Image
                                src={logoDark}
                                className="h-4 w-auto hidden dark:block"
                                alt={"Sourcebot logo"}
                            />
                            <Image
                                src={logoLight}
                                className="h-4 w-auto block dark:hidden"
                                alt={"Sourcebot logo"}
                            />
                        </div>
                        <SearchBar
                            size="sm"
                            defaultQuery={searchQuery}
                        />
                        {isLoading && (
                            <SymbolIcon className="h-4 w-4 animate-spin" />
                        )}
                    </div>
                    <SettingsDropdown
                        menuButtonClassName="w-8 h-8"
                    />
                </div>
                <Separator />
                <div className="bg-accent py-1 px-2 flex flex-row items-center justify-between">
                    <p className="text-sm font-medium">Results for: {fileMatches.length} files in {searchDurationMs} ms</p>
                    {isMoreResultsButtonVisible && (
                        <div
                            className="cursor-pointer text-blue-500 text-sm hover:underline"
                            onClick={() => {
                                const url = createPathWithQueryParams('/search',
                                    ["query", searchQuery],
                                    ["numResults", `${numResults*2}`],
                                )
                                router.push(url);
                            }}
                        >
                            More results
                        </div>
                    )}
                </div>
                <Separator />
            </div>

            {/* Search Results & Code Preview */}
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel minSize={20}>
                    <SearchResultsPanel
                        fileMatches={fileMatches}
                        onOpenFileMatch={(fileMatch) => {
                            setSelectedFile(fileMatch);
                        }}
                        onMatchIndexChanged={(matchIndex) => {
                            setSelectedMatchIndex(matchIndex);
                        }}
                    />
                </ResizablePanel>
                <ResizableHandle withHandle={selectedFile !== undefined} />
                <ResizablePanel
                    minSize={20}
                    hidden={!selectedFile}
                >
                    <CodePreviewWrapper
                        fileMatch={selectedFile}
                        onClose={() => setSelectedFile(undefined)}
                        selectedMatchIndex={selectedMatchIndex}
                        onSelectedMatchIndexChange={setSelectedMatchIndex}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

interface CodePreviewWrapperProps {
    fileMatch?: SearchResultFile;
    onClose: () => void;
    selectedMatchIndex: number;
    onSelectedMatchIndexChange: (index: number) => void;
}

const CodePreviewWrapper = ({
    fileMatch,
    onClose,
    selectedMatchIndex,
    onSelectedMatchIndexChange,
}: CodePreviewWrapperProps) => {

    const { data: file } = useQuery({
        queryKey: ["source", fileMatch?.FileName, fileMatch?.Repository],
        queryFn: async (): Promise<CodePreviewFile | undefined> => {
            if (!fileMatch) {
                return undefined;
            }

            return fetchFileSource(fileMatch.FileName, fileMatch.Repository)
                .then(({ source }) => {
                    // @todo : refector this to use the templates provided by zoekt.
                    const link = getCodeHostFilePreviewLink(fileMatch.Repository, fileMatch.FileName)

                    const decodedSource = atob(source);

                    // Filter out filename matches
                    const filteredMatches = fileMatch.ChunkMatches.filter((match) => {
                        return !match.FileName;
                    });

                    return {
                        content: decodedSource,
                        filepath: fileMatch.FileName,
                        matches: filteredMatches,
                        link: link,
                        language: fileMatch.Language,
                    };
                });
        },
        enabled: fileMatch !== undefined,
    });

    return (
        <CodePreviewPanel
            file={file}
            onClose={onClose}
            selectedMatchIndex={selectedMatchIndex}
            onSelectedMatchIndexChange={onSelectedMatchIndexChange}
        />
    )

}