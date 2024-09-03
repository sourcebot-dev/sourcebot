'use client';

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ZoektFileMatch } from "@/lib/types";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import { useEffect } from "react";
import { VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

interface SearchResultsProps {
    fileMatches: ZoektFileMatch[];
    onOpenFileMatch: (match: ZoektFileMatch) => void;
}

export const SearchResults = ({
    fileMatches,
    onOpenFileMatch,
}: SearchResultsProps) => {

    const FileMatchShim = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const match = fileMatches[index];

        return (
            <div
                style={style}
                onClick={() => onOpenFileMatch(match)}
            >
                <FileMatch
                    match={match}
                    onOpenFile={() => onOpenFileMatch(match)}
                />
            </div>
        )
    };

    const calculateItemSize = (index: number) => {
        const match = fileMatches[index];
        // Base height for the file name row
        let height = 30;
        // Add height for each match line
        height += match.Matches.length * 50;
        // Add some padding
        height += 10;
        return height;
    };

    return (
        <AutoSizer className="h-full w-full">
            {({ height, width }) => (
                <VariableSizeList
                    height={height}
                    width={width}
                    itemCount={fileMatches.length}
                    itemSize={(index) => calculateItemSize(index)}
                >
                    {FileMatchShim}
                </VariableSizeList>
            )}
        </AutoSizer>
    )
}

interface FileMatchProps {
    match: ZoektFileMatch;
    onOpenFile: () => void;
}

const FileMatch = ({
    match,
    onOpenFile,
}: FileMatchProps) => {

    return (
        <div>
            <div className="bg-cyan-200 dark:bg-cyan-900 primary-foreground px-2">
                <span>{match.Repo} · {match.FileName}</span>
            </div>
            {match.Matches.map((match, index) => {
                const fragment = match.Fragments[0];

                return (
                    <div
                        key={index}
                        className="font-mono px-4 py-0.5 text-sm cursor-pointer text-ellipsis"
                        onClick={() => {
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
