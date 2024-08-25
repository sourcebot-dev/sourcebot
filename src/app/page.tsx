'use client';

import Image from "next/image";
import logo from "../../public/sb_logo_large_3.png"
import { Input } from "@/components/ui/input"
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from 'use-debounce';
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation";
import { useNonEmptyQueryParam } from "@/hooks/useNonEmptyQueryParam";

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

interface ZoekSearchResult {
    result: {
        QueryStr: string,
        FileMatches: ZoekFileMatch[] | null,
    }
}


export default function Home() {
    const router = useRouter();
    const defaultQuery = useNonEmptyQueryParam("query") ?? "";
    const defaultNumResults = useNonEmptyQueryParam("numResults");
 
    const [query, setQuery] = useState(defaultQuery);
    const [numResults, _setNumResults] = useState(defaultNumResults && !isNaN(Number(defaultNumResults)) ? Number(defaultNumResults) : 100);

    const [fileMatches, setFileMatches] = useState<ZoekFileMatch[]>([]);

    /**
     * @note : when the user navigates backwards/forwards, the defaultQuery
     * will update, but the query state will not. This effect keeps things in
     * sync for that scenario.
     */
    useEffect(() => {
        setQuery(defaultQuery);
    }, [defaultQuery]);

    return (
        <main className="flex h-screen flex-col">
            <div className="flex flex-row p-2 gap-4 items-center">
                <Image
                    src={logo}
                    className="h-12 w-auto"
                    alt={"Sourcebot logo"}
                />
                <SearchBar
                    query={query}
                    numResults={numResults}
                    onQueryChange={(query) => setQuery(query)}
                    onClear={() => setFileMatches([])}
                    onSearchResult={({ result }) => {
                        setFileMatches(result.FileMatches ?? []);
                        router.push(`?query=${query}&numResults=${numResults}`);
                    }}
                />
            </div>
            <Separator />
            <div className="bg-accent p-2">
                <p className="text-sm font-medium">Results for: {fileMatches.length} files</p>
            </div>
            <div className="flex flex-col gap-2">
                {fileMatches.map((match, index) => (
                    <FileMatch key={index} match={match} />
                ))}
            </div>
        </main>
    );
}

interface SearchBarProps {
    query: string;
    numResults: number;
    onQueryChange: (query: string) => void;
    onSearchResult: (result: ZoekSearchResult) => void,
    onClear: () => void,
}

const SearchBar = ({
    query,
    numResults,
    onQueryChange,
    onSearchResult,
    onClear,
}: SearchBarProps) => {
    const SEARCH_DEBOUNCE_MS = 200;

    const search = useDebouncedCallback((query: string) => {
        if (query === "") {
            onClear();
            return;
        }
        console.log('making query...');
        fetch(`http://localhost:3000/zoekt/search?query=${query}&numResults=${numResults}`)
            .then(response => response.json())
            .then(({ data }: { data: ZoekSearchResult }) => {
                onSearchResult(data);
            })
            // @todo : error handling
            .catch(error => {
                console.error('Error:', error);
            }).finally(() => {
                console.log('done making query');
            })
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
}

const FileMatch = ({
    match,
}: FileMatchProps) => {

    return (
        <div>
            <p><span className="font-bold">{match.Repo}</span> | {match.FileName}</p>
        </div>
    );
}
