'use client';

import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { Separator } from "@/components/ui/separator";
import { DoubleArrowDownIcon, DoubleArrowUpIcon } from "@radix-ui/react-icons";
import { useMemo } from "react";
import { FileMatch } from "./fileMatch";
import { RepositoryInfo, SearchResultFile } from "@/features/search/types";
import { Button } from "@/components/ui/button";

export const MAX_MATCHES_TO_PREVIEW = 3;

interface FileMatchContainerProps {
    file: SearchResultFile;
    onOpenFilePreview: (matchIndex?: number) => void;
    showAllMatches: boolean;
    onShowAllMatchesButtonClicked: () => void;
    isBranchFilteringEnabled: boolean;
    repoInfo: Record<number, RepositoryInfo>;
    yOffset: number;
}

export const FileMatchContainer = ({
    file,
    onOpenFilePreview,
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

    const repo = useMemo(() => {
        return repoInfo[file.repositoryId];
    }, [repoInfo, file.repositoryId]);

    return (
        <div>
            {/* Title */}
            <div
                className="bg-accent primary-foreground px-2 py-0.5 flex flex-row items-center justify-between sticky top-0 z-10"
                style={{
                    top: `-${yOffset}px`,
                }}
            >
                <PathHeader
                    repo={{
                        name: repo.name,
                        codeHostType: repo.codeHostType,
                        displayName: repo.displayName,
                        webUrl: repo.webUrl,
                    }}
                    path={file.fileName.text}
                    pathHighlightRange={fileNameRange}
                    branchDisplayName={branchDisplayName}
                    branchDisplayTitle={branches.join(", ")}
                />
                    <Button
                        variant="link"
                        className="text-blue-500 h-5"
                        onClick={() => {
                            onOpenFilePreview();
                        }}
                    >
                        Preview
                    </Button>
            </div>

            {/* Matches */}
            {matches.map((match, index) => (
                <div
                    key={index}
                >
                    <FileMatch
                        match={match}
                        file={file}
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
                    className="px-4 bg-accent p-0.5 group focus:outline-none"
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") {
                            return;
                        }
                        onShowAllMatchesButtonClicked();
                    }}
                    onClick={onShowAllMatchesButtonClicked}
                >
                    <p
                        className="text-blue-500 w-fit cursor-pointer text-sm flex flex-row items-center gap-2 group-focus:ring-2 group-focus:ring-blue-500 rounded-sm"
                    >
                        {showAllMatches ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                        {showAllMatches ? `Show fewer matches` : `Show ${matchCount - MAX_MATCHES_TO_PREVIEW} more matches`}
                    </p>
                </div>
            )}
        </div>
    );
}