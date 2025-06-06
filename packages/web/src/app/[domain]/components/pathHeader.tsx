'use client';

import { getCodeHostInfoForRepo } from "@/lib/utils";
import { LaptopIcon } from "@radix-ui/react-icons";
import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { useBrowseNavigation } from "../browse/hooks/useBrowseNavigation";
import { Copy, CheckCircle2, ChevronRight } from "lucide-react";
import { useCallback, useState, useMemo } from "react";
import { useToast } from "@/components/hooks/use-toast";

interface FileHeaderProps {
    path: string;
    pathHighlightRange?: {
        from: number;
        to: number;
    }
    pathType?: 'blob' | 'tree';
    repo: {
        name: string;
        codeHostType: string;
        displayName?: string;
        webUrl?: string;
    },
    branchDisplayName?: string;
    branchDisplayTitle?: string;
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

export const PathHeader = ({
    repo,
    path,
    pathHighlightRange,
    branchDisplayName,
    branchDisplayTitle,
    pathType = 'blob',
}: FileHeaderProps) => {
    const info = getCodeHostInfoForRepo({
        name: repo.name,
        codeHostType: repo.codeHostType,
        displayName: repo.displayName,
        webUrl: repo.webUrl,
    });

    const { navigateToPath } = useBrowseNavigation();
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

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

    const onCopyPath = useCallback(() => {
        navigator.clipboard.writeText(path);
        setCopied(true);
        toast({ description: "✅ Copied to clipboard" });
        setTimeout(() => setCopied(false), 1500);
    }, [path, toast]);

    const onBreadcrumbClick = useCallback((segment: BreadcrumbSegment) => {
        navigateToPath({
            repoName: repo.name,
            path: segment.fullPath,
            pathType: segment.isLastSegment ? pathType : 'tree',
            revisionName: branchDisplayName,
        });
    }, [repo.name, branchDisplayName, navigateToPath, pathType]);

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
            {info?.icon ? (
                <Image
                    src={info.icon}
                    alt={info.codeHostName}
                    className={`w-4 h-4 ${info.iconClassName}`}
                />
            ): (
                <LaptopIcon className="w-4 h-4" />
            )}
            <Link
                className={clsx("font-medium", {
                    "cursor-pointer hover:underline": info?.repoLink,
                })}
                href={info?.repoLink ?? ""}
            >
                {info?.displayName}
            </Link>
            {branchDisplayName && (
                <p
                    className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-[3px] flex items-center gap-0.5"
                    title={branchDisplayTitle}
                    style={{
                        marginBottom: "0.1rem",
                    }}
                >
                    <span className="mr-0.5">@</span>
                    {`${branchDisplayName}`}
                </p>
            )}
            <span>·</span>
            <div className="flex-1 flex items-center overflow-hidden mt-0.5">
                <div className="flex items-center overflow-hidden">
                    {breadcrumbSegments.map((segment, index) => (
                        <div key={segment.fullPath} className="flex items-center">
                            <span
                                className={clsx(
                                    "font-mono text-sm truncate cursor-pointer hover:underline",
                                )}
                                onClick={() => onBreadcrumbClick(segment)}
                            >
                                {renderSegmentWithHighlight(segment)}
                            </span>
                            {index < breadcrumbSegments.length - 1 && (
                                <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground flex-shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
                <button
                    className="ml-2 p-1 rounded transition-colors flex-shrink-0"
                    onClick={onCopyPath}
                    aria-label="Copy file path"
                    type="button"
                >
                    {copied ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                        <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                </button>
            </div>
        </div>
    )
}