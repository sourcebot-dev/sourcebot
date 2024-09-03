'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ZoektFileMatch } from "@/lib/types";
import { Scrollbar } from "@radix-ui/react-scroll-area";

interface SearchResultsProps {
    fileMatches: ZoektFileMatch[];
    onOpenFileMatch: (match: ZoektFileMatch) => void;
}

export const SearchResults = ({
    fileMatches,
    onOpenFileMatch,
}: SearchResultsProps) => {
    return (
        <ScrollArea className="h-full">
            <div className="flex flex-col gap-2">
                {fileMatches.map((match, index) => (
                    <FileMatch
                        key={index}
                        match={match}
                        onOpenFile={() => {
                            onOpenFileMatch(match);
                        }}
                    />
                ))}
            </div>
            <Scrollbar orientation="vertical" />
        </ScrollArea>
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
                        className="font-mono px-4 py-0.5 text-sm cursor-pointer"
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
