'use client';

import { VscodeFileIcon } from '@/app/components/vscodeFileIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDomain } from '@/hooks/useDomain';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import React from 'react';
import { getBrowsePath } from '@/app/[domain]/browse/hooks/useBrowseNavigation';


export const FileListItem = ({
    path,
    repoName,
}: {
    path: string,
    repoName: string,
}) => {
    const domain = useDomain();

    return (
        <div key={path} className="flex flex-row items-center overflow-hidden hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer p-0.5">
            <VscodeFileIcon fileName={path} className="mr-1 flex-shrink-0" />
            <Link
                className="text-sm truncate-start"
                href={getBrowsePath({
                    repoName,
                    revisionName: 'HEAD',
                    path,
                    domain,
                    pathType: 'blob',
                })}
            >
                {path}
            </Link>
        </div>
    )
}

export const TreeList = ({ children }: { children: React.ReactNode }) => {
    const childrenArray = React.Children.toArray(children);

    return (
        <ScrollArea className="flex flex-col relative mt-0.5 ml-[7px] max-h-60">
            {/* vertical line */}
            <div
                className="absolute left-0 top-0 w-px bg-border"
                style={{
                    bottom: childrenArray.length > 0 ? `${100 / childrenArray.length * 0.6}%` : '0'
                }}
            />

            {childrenArray.map((child, index) => {
                const isLast = index === childrenArray.length - 1;

                return (
                    <div
                        key={index}
                        className="relative py-0.5"
                    >
                        {!isLast && (
                            <div className="absolute left-0 w-3 h-px bg-border top-1/2"></div>
                        )}
                        {isLast && (
                            <div
                                className="absolute left-0 w-3 h-3 border-l border-b border-border rounded-bl"
                                style={{ top: 'calc(50% - 11px)' }}
                            />
                        )}

                        <div className="ml-4">{child}</div>
                    </div>
                )
            })}
        </ScrollArea>
    );
};

interface ToolHeaderProps {
    isLoading: boolean;
    isError: boolean;
    isExpanded: boolean;
    label: string;
    Icon: React.ElementType;
    onExpand: (isExpanded: boolean) => void;
    className?: string;
}

export const ToolHeader = ({ isLoading, isError, isExpanded, label, Icon, onExpand, className }: ToolHeaderProps) => {
    return (
        <div
            tabIndex={0}
            className={cn(
                "flex flex-row items-center gap-2 text-muted-foreground group w-fit select-none",
                {
                    'hover:text-foreground cursor-pointer': !isLoading,
                },
                className,
            )}
            onClick={() => {
                onExpand(!isExpanded)
            }}
            onKeyDown={(e) => {
                if (e.key !== "Enter") {
                    return;
                }
                onExpand(!isExpanded);
            }}
        >
            {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Icon className="h-4 w-4" />
            )}
            <span className={cn("text-sm font-medium",
                {
                    'animate-pulse': isLoading,
                    'text-destructive': isError,
                }
            )}>{label}</span>
            {!isLoading && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {isExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                    ) : (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </div>
            )}
        </div>
    )
}