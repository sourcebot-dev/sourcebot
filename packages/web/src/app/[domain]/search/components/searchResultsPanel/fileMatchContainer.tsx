'use client';

import { FileHeader } from "@/app/[domain]/components/fireHeader";
import { Separator } from "@/components/ui/separator";
import { Repository, SearchResultFile } from "@/lib/types";
import { DoubleArrowDownIcon, DoubleArrowUpIcon } from "@radix-ui/react-icons";
import { useCallback, useMemo } from "react";
import { FileMatch } from "./fileMatch";

export const MAX_MATCHES_TO_PREVIEW = 3;

interface FileMatchContainerProps {
    file: SearchResultFile;
    onOpenFile: () => void;
    onMatchIndexChanged: (matchIndex: number) => void;
    showAllMatches: boolean;
    onShowAllMatchesButtonClicked: () => void;
    isBranchFilteringEnabled: boolean;
    repoMetadata: Record<string, Repository>;
}

export const FileMatchContainer = ({
    file,
    onOpenFile,
    onMatchIndexChanged,
    showAllMatches,
    onShowAllMatchesButtonClicked,
    isBranchFilteringEnabled,
    repoMetadata,
}: FileMatchContainerProps) => {

    const matchCount = useMemo(() => {
        return file.ChunkMatches.length;
    }, [file]);

    const matches = useMemo(() => {
        const sortedMatches = file.ChunkMatches.sort((a, b) => {
            return a.ContentStart.LineNumber - b.ContentStart.LineNumber;
        });

        if (!showAllMatches) {
            return sortedMatches.slice(0, MAX_MATCHES_TO_PREVIEW);
        }

        return sortedMatches;
    }, [file, showAllMatches]);

    const fileNameRange = useMemo(() => {
        for (const match of matches) {
            if (match.FileName && match.Ranges.length > 0) {
                const range = match.Ranges[0];
                return {
                    from: range.Start.Column - 1,
                    to: range.End.Column - 1,
                }
            }
        }

        return undefined;
    }, [matches]);

    const isMoreContentButtonVisible = useMemo(() => {
        return matchCount > MAX_MATCHES_TO_PREVIEW;
    }, [matchCount]);

    const onOpenMatch = useCallback((index: number) => {
        const matchIndex = matches.slice(0, index).reduce((acc, match) => {
            return acc + match.Ranges.length;
        }, 0);
        onOpenFile();
        onMatchIndexChanged(matchIndex);
    }, [matches, onMatchIndexChanged, onOpenFile]);

    const branches = useMemo(() => {
        if (!file.Branches) {
            return [];
        }

        return file.Branches;
    }, [file.Branches]);

    const branchDisplayName = useMemo(() => {
        if (!isBranchFilteringEnabled || branches.length === 0) {
            return undefined;
        }

        return `${branches[0]}${branches.length > 1 ? ` +${branches.length - 1}` : ''}`;
    }, [isBranchFilteringEnabled, branches]);


    return (
        <div>
            {/* Title */}
            <div
                className="top-0 bg-cyan-200 dark:bg-cyan-900 primary-foreground px-2 py-0.5 flex flex-row items-center justify-between cursor-pointer"
                onClick={() => {
                    onOpenFile();
                }}
            >
                <FileHeader
                    repo={repoMetadata[file.Repository]}
                    fileName={file.FileName}
                    fileNameHighlightRange={fileNameRange}
                    branchDisplayName={branchDisplayName}
                    branchDisplayTitle={branches.join(", ")}
                />
            </div>

            {/* Matches */}
            {matches.map((match, index) => (
                <div
                    key={index}
                >
                    <FileMatch
                        match={match}
                        file={file}
                        onOpen={() => {
                            onOpenMatch(index);
                        }}
                    />
                    {(index !== matches.length - 1 || isMoreContentButtonVisible) && (
                        <Separator className="dark:bg-gray-400" />
                    )}
                </div>
            ))}

            {/* Show more button */}
            {isMoreContentButtonVisible && (
                <div
                    tabIndex={0}
                    className="px-4 bg-accent p-0.5"
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") {
                            return;
                        }
                        onShowAllMatchesButtonClicked();
                    }}
                    onClick={onShowAllMatchesButtonClicked}
                >
                    <p
                        className="text-blue-500 cursor-pointer text-sm flex flex-row items-center gap-2"
                    >
                        {showAllMatches ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                        {showAllMatches ? `Show fewer matches` : `Show ${matchCount - MAX_MATCHES_TO_PREVIEW} more matches`}
                    </p>
                </div>
            )}
        </div>
    );
}