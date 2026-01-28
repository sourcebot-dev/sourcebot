'use client';

import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { PathHeader } from "@/app/[domain]/components/pathHeader";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import { FindRelatedSymbolsResponse } from "@/features/codeNav/types";
import { RepositoryInfo, SourceRange } from "@/features/search";
import { useMemo, useRef } from "react";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useDomain } from "@/hooks/useDomain";

interface ReferenceListProps {
    data: FindRelatedSymbolsResponse;
    revisionName: string;
}

const ESTIMATED_LINE_HEIGHT_PX = 30;
const ESTIMATED_MATCH_CONTAINER_HEIGHT_PX = 30;

export const ReferenceList = ({
    data,
    revisionName,
}: ReferenceListProps) => {
    const domain = useDomain();
    const repoInfoMap = useMemo(() => {
        return data.repositoryInfo.reduce((acc, repo) => {
            acc[repo.id] = repo;
            return acc;
        }, {} as Record<number, RepositoryInfo>);
    }, [data.repositoryInfo]);

    const captureEvent = useCaptureEvent();

    // Virtualization setup
    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: data.files.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => {
            const file = data.files[index];

            const estimatedSize =
                file.matches.length * ESTIMATED_LINE_HEIGHT_PX +
                ESTIMATED_MATCH_CONTAINER_HEIGHT_PX;

            return estimatedSize;
        },
        overscan: 5,
        enabled: true,
    });

    return (
        <div
            ref={parentRef}
            style={{
                width: "100%",
                height: "100%",
                overflowY: "auto",
                contain: "strict",
            }}
        >
            <div
                style={{
                    height: virtualizer.getTotalSize(),
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                    const file = data.files[virtualRow.index];
                    const repoInfo = repoInfoMap[file.repositoryId];
                    return (
                        <div
                            key={virtualRow.key}
                            data-index={virtualRow.index}
                            ref={virtualizer.measureElement}
                            style={{
                                position: "absolute",
                                transform: `translateY(${virtualRow.start}px)`,
                                top: 0,
                                left: 0,
                                width: "100%",
                            }}
                        >
                            <div
                                className="bg-accent py-1 px-2 flex flex-row sticky top-0 z-10"
                                style={{
                                    top: `-${virtualRow.start}px`,
                                }}
                            >
                                <PathHeader
                                    repo={{
                                        name: repoInfo.name,
                                        displayName: repoInfo.displayName,
                                        codeHostType: repoInfo.codeHostType,
                                        externalWebUrl: repoInfo.webUrl,
                                    }}
                                    path={file.fileName}
                                    revisionName={revisionName === "HEAD" ? undefined : revisionName}
                                />
                            </div>
                            <div className="divide-y">
                                {file.matches
                                    .sort((a, b) => a.range.start.lineNumber - b.range.start.lineNumber)
                                    .map((match, index) => (
                                        <Link
                                            href={getBrowsePath({
                                                repoName: file.repository,
                                                revisionName,
                                                path: file.fileName,
                                                pathType: 'blob',
                                                highlightRange: match.range,
                                                domain,
                                            })}
                                            onClick={() => {
                                                captureEvent('wa_explore_menu_reference_clicked', {});
                                            }}
                                            key={index}
                                        >
                                            <ReferenceListItem
                                                lineContent={match.lineContent}
                                                range={match.range}
                                                language={file.language}
                                            />
                                        </Link>
                                    ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


interface ReferenceListItemProps {
    lineContent: string;
    range: SourceRange;
    language: string;
}

const ReferenceListItem = ({
    lineContent,
    range,
    language,
}: ReferenceListItemProps) => {
    const highlightRanges = useMemo(() => [range], [range]);

    return (
        <div
            className="w-full hover:bg-accent py-1 cursor-pointer"
        >
            <LightweightCodeHighlighter
                language={language}
                highlightRanges={highlightRanges}
                lineNumbers={true}
                lineNumbersOffset={range.start.lineNumber}
                renderWhitespace={false}
            >
                {lineContent}
            </LightweightCodeHighlighter>
        </div>
    )
}
