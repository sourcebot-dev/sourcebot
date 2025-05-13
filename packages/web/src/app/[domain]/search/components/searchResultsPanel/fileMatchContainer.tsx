'use client';

import { FileHeader } from "@/app/[domain]/components/fileHeader";
import { Separator } from "@/components/ui/separator";
import { DoubleArrowDownIcon, DoubleArrowUpIcon } from "@radix-ui/react-icons";
import { useCallback, useMemo } from "react";
import { FileMatch } from "./fileMatch";
import { RepositoryInfo, SearchResultFile } from "@/features/search/types";

export const MAX_MATCHES_TO_PREVIEW = 3;

interface FileMatchContainerProps {
    file: SearchResultFile;
    onOpenFile: () => void;
    onMatchIndexChanged: (matchIndex: number) => void;
    showAllMatches: boolean;
    onShowAllMatchesButtonClicked: () => void;
    isBranchFilteringEnabled: boolean;
    repoInfo: Record<number, RepositoryInfo>;
    yOffset: number;
}

export const FileMatchContainer = ({
    file,
    onOpenFile,
    onMatchIndexChanged,
    showAllMatches,
    onShowAllMatchesButtonClicked,
    isBranchFilteringEnabled,
    repoInfo,
    yOffset,
}: FileMatchContainerProps) => {

    const matchCount = useMemo(() => {
        return file.chunks.length;
    }, [file]);

    const matches = useMemo(() => {
        const sortedMatches = file.chunks.sort((a, b) => {
            return a.contentStart.lineNumber - b.contentStart.lineNumber;
        });

        if (!showAllMatches) {
            return sortedMatches.slice(0, MAX_MATCHES_TO_PREVIEW);
        }

        return sortedMatches;
    }, [file, showAllMatches]);

    const fileNameRange = useMemo(() => {
        if (file.fileName.matchRanges.length > 0) {
            const range = file.fileName.matchRanges[0];
            return {
                from: range.start.column - 1,
                to: range.end.column - 1,
            }
        }

        return undefined;
    }, [file.fileName.matchRanges]);

    const isMoreContentButtonVisible = useMemo(() => {
        return matchCount > MAX_MATCHES_TO_PREVIEW;
    }, [matchCount]);

    const onOpenMatch = useCallback((index: number) => {
        const matchIndex = matches.slice(0, index).reduce((acc, match) => {
            return acc + match.matchRanges.length;
        }, 0);
        onOpenFile();
        onMatchIndexChanged(matchIndex);
    }, [matches, onMatchIndexChanged, onOpenFile]);

    const branches = useMemo(() => {
        if (!file.branches) {
            return [];
        }

        return file.branches;
    }, [file.branches]);

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
                className="bg-accent primary-foreground px-2 py-0.5 flex flex-row items-center justify-between cursor-pointer sticky top-0 z-10"
                style={{
                    top: `-${yOffset}px`,
                }}
                onClick={() => {
                    onOpenFile();
                }}
            >
                <FileHeader
                    repoInfo={repoInfo[file.repositoryId]}
                    fileName={file.fileName.text}
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
                        <Separator className="bg-accent" />
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