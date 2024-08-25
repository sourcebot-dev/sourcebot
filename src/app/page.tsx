'use client';

import Image from "next/image";
import logo from "../../public/sb_logo_large_3.png"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react";
import { useDebouncedCallback } from 'use-debounce';
import { Separator } from "@/components/ui/separator"

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

    const [fileMatches, setFileMatches] = useState<ZoekFileMatch[]>([]);

    const onSearchChanged = useDebouncedCallback((query: string) => {
        if (query === "") {
            setFileMatches([]);
            return;
        }
        console.log('making query...');
        fetch(`${document.baseURI}/zoekt/search?query=${query}&numResults=50`)
            .then(response => response.json())
            .then(({ data }: { data: ZoekSearchResult }) => {
                const result = data.result;
                setFileMatches(result.FileMatches ?? []);
            })
            .catch(error => {
                console.error('Error:', error);
            }).finally(() => {
                console.log('done making query');
            })
    }, 200);

    return (
        <main className="flex h-screen flex-col">
            <div className="flex flex-row p-2 gap-4 items-center">
                <Image
                    src={logo}
                    className="h-12 w-auto"
                    alt={"Sourcebot logo"}
                />
                <Input
                    className="max-w-lg"
                    placeholder="Search..."
                    onChange={(e) => {
                        const query = e.target.value;
                        onSearchChanged(query);
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
