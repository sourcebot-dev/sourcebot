'use client';

import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchResultFile } from "@/lib/schemas";
import { Scrollbar } from "@radix-ui/react-scroll-area";
import { FileMatchContainer } from "./fileMatchContainer";

interface SearchResultsPanelProps {
    fileMatches: SearchResultFile[];
    onOpenFileMatch: (fileMatch: SearchResultFile) => void;
    onMatchIndexChanged: (matchIndex: number) => void;
}

export const SearchResultsPanel = ({
    fileMatches,
    onOpenFileMatch,
    onMatchIndexChanged,
}: SearchResultsPanelProps) => {

    if (fileMatches.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No results found</p>
            </div>
        );
    }

    return (
        <ScrollArea
            className="h-full"
        >
            {fileMatches.map((fileMatch, index) => (
                <FileMatchContainer
                    key={index}
                    file={fileMatch}
                    onOpenFile={() => {
                        onOpenFileMatch(fileMatch);
                    }}
                    onMatchIndexChanged={(matchIndex) => {
                        onMatchIndexChanged(matchIndex);
                    }}
                />
            ))}
            <Scrollbar orientation="vertical" />
        </ScrollArea>
    )
}