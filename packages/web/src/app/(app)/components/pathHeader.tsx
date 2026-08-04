'use client';

import { cn, getCodeHostInfoForRepo, truncateSha } from "@/lib/utils";
import Image from "next/image";
import { getBrowsePath } from "../browse/hooks/utils";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import { useCallback, useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { useToast } from "@/components/hooks/use-toast";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { CopyIconButton } from "./copyIconButton";
import Link from "next/link";
import { CodeHostType } from "@sourcebot/db";

interface FileHeaderProps {
    path: string;
    pathHighlightRange?: {
        from: number;
        to: number;
    }
    pathType?: 'blob' | 'tree';
    repo: {
        name: string;
        codeHostType: CodeHostType;
        displayName?: string;
        externalWebUrl?: string;
    },
    isBranchDisplayNameVisible?: boolean;
    branchDisplayName?: string;
    revisionName?: string;
    branchDisplayTitle?: string;
    isCodeHostIconVisible?: boolean;
    isFileIconVisible?: boolean;
    repoNameClassName?: string;
}

interface BreadcrumbSegment {
    name: string;
    fullPath: string;
    isLastSegment: boolean;
    highlightRange?: {
        from: number;
        to: number;
    };
}

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export const PathHeader = ({
    repo,
    path,
    pathHighlightRange,
    revisionName,
    branchDisplayName = revisionName,
    isBranchDisplayNameVisible = !!branchDisplayName,
    branchDisplayTitle,
    pathType = 'blob',
    isCodeHostIconVisible = true,
    isFileIconVisible = true,
    repoNameClassName,
}: FileHeaderProps) => {
    const info = getCodeHostInfoForRepo({
        name: repo.name,
        codeHostType: repo.codeHostType,
        displayName: repo.displayName,
        externalWebUrl: repo.externalWebUrl,
    });

    const { toast } = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const breadcrumbsRef = useRef<HTMLDivElement>(null);
    const [visibleSegmentCount, setVisibleSegmentCount] = useState<number | null>(null);
    // Create breadcrumb segments from file path
    const breadcrumbSegments = useMemo(() => {
        const pathParts = path.split('/').filter(Boolean);
        const segments: BreadcrumbSegment[] = [];

        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const isLastSegment = index === pathParts.length - 1;

            // Calculate highlight range for this segment if it exists
            let segmentHighlight: { from: number; to: number } | undefined;
            if (pathHighlightRange) {
                const segmentStart = path.indexOf(part, currentPath.length - part.length);
                const segmentEnd = segmentStart + part.length;

                // Check if highlight overlaps with this segment
                if (pathHighlightRange.from < segmentEnd && pathHighlightRange.to > segmentStart) {
                    segmentHighlight = {
                        from: Math.max(0, pathHighlightRange.from - segmentStart),
                        to: Math.min(part.length, pathHighlightRange.to - segmentStart)
                    };
                }
            }

            segments.push({
                name: part,
                fullPath: currentPath,
                isLastSegment,
                highlightRange: segmentHighlight
            });
        });

        return segments;
    }, [path, pathHighlightRange]);

    // Calculate which segments should be visible based on available space
    useIsomorphicLayoutEffect(() => {
        const measureSegments = () => {
            if (!containerRef.current || !breadcrumbsRef.current) return;

            const containerWidth = containerRef.current.offsetWidth;
            const availableWidth = containerWidth - 40; // Reserve space for copy button and padding
            const collapsedPrefixWidth = 40; // Ellipsis button + separator
            const fileIconWidth = isFileIconVisible ? 20 : 0; // Icon + right margin

            // Create a temporary element to measure segment widths
            const tempElement = document.createElement('div');
            tempElement.style.position = 'absolute';
            tempElement.style.visibility = 'hidden';
            tempElement.style.whiteSpace = 'nowrap';
            tempElement.className = 'font-mono text-sm';
            document.body.appendChild(tempElement);

            const segmentWidths = breadcrumbSegments.map((segment) => {
                tempElement.textContent = segment.name;
                return tempElement.offsetWidth;
            });

            const fullBreadcrumbWidth = segmentWidths.reduce((width, segmentWidth) => width + segmentWidth, fileIconWidth)
                + Math.max(0, breadcrumbSegments.length - 1) * 16;

            let visibleCount = breadcrumbSegments.length;

            if (fullBreadcrumbWidth > availableWidth) {
                let visibleWidth = fileIconWidth;
                visibleCount = 0;

                // Keep the largest suffix that fits alongside the collapsed-prefix control.
                for (let i = breadcrumbSegments.length - 1; i >= 0; i--) {
                    const separatorWidth = visibleCount > 0 ? 16 : 0;
                    const candidateWidth = visibleWidth + segmentWidths[i] + separatorWidth;
                    const prefixWidth = i > 0 ? collapsedPrefixWidth : 0;

                    if (candidateWidth + prefixWidth > availableWidth) {
                        // The final segment is always visible. It may truncate when there
                        // is not enough room for it and the fixed controls by themselves.
                        if (visibleCount === 0) {
                            visibleCount = 1;
                        }
                        break;
                    }

                    visibleWidth = candidateWidth;
                    visibleCount++;
                }
            }

            document.body.removeChild(tempElement);
            setVisibleSegmentCount(visibleCount);
        };

        measureSegments();

        const resizeObserver = new ResizeObserver(measureSegments);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, [breadcrumbSegments, isFileIconVisible]);

    const hiddenSegments = useMemo(() => {
        if (visibleSegmentCount === null || visibleSegmentCount >= breadcrumbSegments.length) {
            return [];
        }
        return breadcrumbSegments.slice(0, breadcrumbSegments.length - visibleSegmentCount);
    }, [breadcrumbSegments, visibleSegmentCount]);

    const visibleSegments = useMemo(() => {
        if (visibleSegmentCount === null) {
            return breadcrumbSegments;
        }
        return breadcrumbSegments.slice(breadcrumbSegments.length - visibleSegmentCount);
    }, [breadcrumbSegments, visibleSegmentCount]);

    const onCopyPath = useCallback(() => {
        navigator.clipboard.writeText(path);
        toast({ description: "✅ Copied to clipboard" });
        return true;
    }, [path, toast]);

    const renderSegmentWithHighlight = (segment: BreadcrumbSegment) => {
        if (!segment.highlightRange) {
            return segment.name;
        }

        const { from, to } = segment.highlightRange;
        return (
            <>
                {segment.name.slice(0, from)}
                <span className="bg-yellow-200 dark:bg-blue-700">
                    {segment.name.slice(from, to)}
                </span>
                {segment.name.slice(to)}
            </>
        );
    };

    return (
        <div className="flex flex-row gap-2 items-center w-full overflow-hidden">
            {isCodeHostIconVisible && (
                <>
                    <a href={info.externalWebUrl} target="_blank" rel="noopener noreferrer">
                        <Image
                            src={info.icon}
                            alt={info.codeHostName}
                            className={`w-4 h-4 ${info.iconClassName}`}
                        />
                    </a>
                </>
            )}

            <Link
                className={cn("font-medium cursor-pointer hover:underline", repoNameClassName)}
                href={getBrowsePath({
                    repoName: repo.name,
                    path: '/',
                    pathType: 'tree',
                    revisionName,
                })}
            >
                {info?.displayName}
            </Link>
            {(isBranchDisplayNameVisible && branchDisplayName) && (
                <p
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-[3px] flex items-center gap-0.5"
                    title={branchDisplayTitle}
                    style={{
                        marginBottom: "0.1rem",
                    }}
                >
                    <span className="mr-0.5">@</span>
                    <Link
                        href={getBrowsePath({
                            repoName: repo.name,
                            path: '',
                            pathType: 'commit',
                            commitSha: branchDisplayName,
                        })}
                        className="hover:underline"
                    >
                        {truncateSha(branchDisplayName.replace(/^refs\/(heads|tags)\//, ''))}
                    </Link>
                </p>
            )}
            {breadcrumbSegments.length > 0 && (
                <span>·</span>
            )}
            <div
                ref={containerRef}
                className={cn(
                    "flex-1 min-w-0 flex items-center overflow-hidden mt-0.5",
                    visibleSegmentCount === null && "invisible",
                )}
            >
                <div ref={breadcrumbsRef} className="flex min-w-0 items-center overflow-hidden">
                    {hiddenSegments.length > 0 && (
                        <>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        className="font-mono text-sm cursor-pointer hover:underline p-1 rounded transition-colors shrink-0"
                                        aria-label="Show hidden path segments"
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-[200px]">
                                    {hiddenSegments.map((segment) => (
                                        <Link
                                            href={getBrowsePath({
                                                repoName: repo.name,
                                                path: segment.fullPath,
                                                pathType: segment.isLastSegment ? pathType : 'tree',
                                                revisionName,
                                            })}
                                            className="font-mono text-sm hover:cursor cursor-pointer"
                                            key={segment.fullPath}
                                        >
                                            <DropdownMenuItem className="hover:cursor cursor-pointer">
                                                {renderSegmentWithHighlight(segment)}
                                            </DropdownMenuItem>
                                        </Link>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground flex-shrink-0" />
                        </>
                    )}
                    {visibleSegments.map((segment, index) => (
                        <div
                            key={segment.fullPath}
                            className={cn(
                                "flex items-center",
                                index === visibleSegments.length - 1 ? "min-w-0" : "shrink-0",
                            )}
                        >
                            {(isFileIconVisible && index === visibleSegments.length - 1) && (
                                <VscodeFileIcon fileName={segment.name} className="h-4 w-4 mr-1 flex-shrink-0" />
                            )}
                            <Link
                                className={cn(
                                    "font-mono text-sm min-w-0 truncate cursor-pointer hover:underline",
                                )}
                                href={getBrowsePath({
                                    repoName: repo.name,
                                    path: segment.fullPath,
                                    pathType: segment.isLastSegment ? pathType : 'tree',
                                    revisionName,
                                })}
                            >
                                {renderSegmentWithHighlight(segment)}
                            </Link>
                            {index < visibleSegments.length - 1 && (
                                <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
                {breadcrumbSegments.length > 0 && (
                    <CopyIconButton
                        onCopy={onCopyPath}
                        className="ml-2 shrink-0"
                    />
                )}
            </div>
        </div>
    )
}
