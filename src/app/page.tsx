'use client';

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";
import { defaultKeymap } from "@codemirror/commands";
import { javascript } from "@codemirror/lang-javascript";
import { keymap } from "@codemirror/view";
import { SymbolIcon } from "@radix-ui/react-icons";
import { ScrollArea, Scrollbar } from "@radix-ui/react-scroll-area";
import CodeMirror from '@uiw/react-codemirror';
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebouncedCallback } from 'use-debounce';
import logo from "../../public/sb_logo_large_3.png";

import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { GetSourceResponse, pathQueryParamName, repoQueryParamName } from "@/lib/api";
import { createPathWithQueryParams } from "@/lib/utils";

interface ZoekMatch {
    URL: string,
    FileName: string,
    LineNum: number,
    Fragments: {
        Pre: string,
        Match: string,
        Post: string
    }[]
}

interface ZoekFileMatch {
    FileName: string,
    Repo: string,
    Language: string,
    Matches: ZoekMatch[],
    URL: string,
}

interface ZoekResult {
    QueryStr: string,
    FileMatches: ZoekFileMatch[] | null,
    Stats: {
        // Duration in nanoseconds
        Duration: number,
    }
}

interface ZoekSearchResponse {
    result: ZoekResult,
}

export default function Home() {
    const router = useRouter();
    const defaultQuery = useNonEmptyQueryParam("query") ?? "";
    const defaultNumResults = useNonEmptyQueryParam("numResults");

    const [query, setQuery] = useState(defaultQuery);
    const [numResults, _setNumResults] = useState(defaultNumResults && !isNaN(Number(defaultNumResults)) ? Number(defaultNumResults) : 100);

    const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
    const [code, setCode] = useState("");

    const [fileMatches, setFileMatches] = useState<ZoekFileMatch[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchDurationMs, setSearchDurationMs] = useState(0);

    // @todo: We need to be able to handle the case when the user navigates backwards / forwards.
    // Currently we do not re-query.

    return (
        <main className="h-screen overflow-hidden">
            <div className="sticky top-0 left-0 right-0 bg-white z-10">
                <div className="flex flex-row p-1 gap-4 items-center">
                    <Image
                        src={logo}
                        className="h-12 w-auto"
                        alt={"Sourcebot logo"}
                    />
                    <SearchBar
                        query={query}
                        numResults={numResults}
                        onQueryChange={(query) => setQuery(query)}
                        onLoadingChange={(isLoading) => setIsLoading(isLoading)}
                        onSearchResult={(result) => {
                            if (result) {
                                setFileMatches(result.FileMatches ?? []);
                                setSearchDurationMs(Math.round(result.Stats.Duration / 1000000));
                            }

                            router.push(`?query=${query}&numResults=${numResults}`);
                        }}
                    />
                    {isLoading && (
                        <SymbolIcon className="h-4 w-4 animate-spin" />
                    )}
                </div>
                <Separator />
                <div className="bg-accent p-2">
                    <p className="text-sm font-medium">Results for: {fileMatches.length} files in {searchDurationMs} ms</p>
                </div>
                <Separator />
            </div>
            <ResizablePanelGroup direction="horizontal">
                <ResizablePanel minSize={20}>
                    <ScrollArea className="h-full overflow-y-auto">
                        <div className="flex flex-col gap-2">
                            {fileMatches.map((match, index) => (
                                <FileMatch
                                    key={index}
                                    match={match}
                                    onOpenFile={() => {
                                        const url = createPathWithQueryParams(
                                            `http://localhost:3000/api/source`,
                                            [pathQueryParamName, match.FileName],
                                            [repoQueryParamName, match.Repo]
                                        );

                                        // @todo : this query should definitely be cached s.t., when the user is switching between files,
                                        // we aren't re-fetching the same file.
                                        fetch(url)
                                            .then(response => response.json())
                                            .then((body: GetSourceResponse) => {
                                                setIsCodePanelOpen(true);
                                                setCode(body.content);
                                            });
                                    }}
                                />
                            ))}
                        </div>
                        <Scrollbar orientation="vertical" />
                    </ScrollArea>
                </ResizablePanel>
                <ResizableHandle withHandle={true} />
                {isCodePanelOpen && (
                    <ResizablePanel
                        minSize={20}
                    >
                        <CodeEditor
                            code={code}
                        />
                    </ResizablePanel>
                )}
            </ResizablePanelGroup>
        </main>
    );
}

interface CodeEditorProps {
    code: string;
}

const CodeEditor = ({
    code,
}: CodeEditorProps) => {
    return (
        <ScrollArea className="h-full overflow-y-auto">
            <CodeMirror
                editable={false}
                value={code}
                extensions={[
                    keymap.of(defaultKeymap),
                    javascript(),
                ]}
            />
            <Scrollbar orientation="vertical" />
        </ScrollArea>
    )
}

interface SearchBarProps {
    query: string;
    numResults: number;
    onLoadingChange: (isLoading: boolean) => void;
    onQueryChange: (query: string) => void;
    onSearchResult: (result?: ZoekResult) => void,
}

const SearchBar = ({
    query,
    numResults,
    onLoadingChange,
    onQueryChange,
    onSearchResult,
}: SearchBarProps) => {
    const SEARCH_DEBOUNCE_MS = 200;

    // @todo : we should probably be cancelling any running requests
    const search = useDebouncedCallback((query: string) => {
        if (query === "") {
            onSearchResult(undefined);
            return;
        }
        console.log('making query...');

        onLoadingChange(true);
        fetch(`http://localhost:3000/api/search?query=${query}&numResults=${numResults}`)
            .then(response => response.json())
            .then(({ data }: { data: ZoekSearchResponse }) => {
                onSearchResult(data.result);
            })
            // @todo : error handling
            .catch(error => {
                console.error('Error:', error);
            }).finally(() => {
                console.log('done making query');
                onLoadingChange(false);
            });
    }, SEARCH_DEBOUNCE_MS);

    useEffect(() => {
        search(query);
    }, [query]);

    return (
        <Input
            value={query}
            className="max-w-lg"
            placeholder="Search..."
            onChange={(e) => {
                const query = e.target.value;
                onQueryChange(query);
            }}
        />
    )
}

interface FileMatchProps {
    match: ZoekFileMatch;
    onOpenFile: () => void;
}

const FileMatch = ({
    match,
    onOpenFile,
}: FileMatchProps) => {

    return (
        <div>
            <div className="bg-cyan-200 primary-foreground px-2">
                <span>{match.Repo} · {match.FileName}</span>
            </div>
            {match.Matches.map((match, index) => {
                const fragment = match.Fragments[0];

                return (
                    <div
                        key={index}
                        className="font-mono px-4 py-0.5 text-sm cursor-pointer"
                        onClick={() =>{
                            onOpenFile();
                        }}
                    >
                        <p>{match.LineNum}: {fragment.Pre}<span className="font-bold">{fragment.Match}</span>{fragment.Post}</p>
                        <Separator />
                    </div>
                );
            })}
        </div>
    );
}
