'use client';

import { cn } from "@/lib/utils";
import { createTruncatedRepoDisplay, createBreadcrumbRepoDisplay, getProjectName, createCompactRepoDisplay } from "@/lib/repositoryDisplayUtils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbEllipsis, BreadcrumbSeparator } from "./breadcrumb";
import React from "react";

export interface RepositoryNameProps {
    repoName: string;
    displayMode?: 'truncate' | 'breadcrumb' | 'project-only' | 'compact';
    maxLength?: number;
    className?: string;
    tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
    showTooltip?: boolean;
    customTooltipContent?: React.ReactNode;
}

/**
 * A flexible component for displaying repository names with intelligent truncation.
 * Automatically handles long GitLab project names with nested groups.
 * 
 * Display modes:
 * - 'truncate': Shows meaningful parts with ellipsis (default)
 * - 'breadcrumb': Shows breadcrumb-style navigation with collapsing
 * - 'project-only': Shows only the project name
 * - 'compact': Shows project name with group context in parentheses
 */
export const RepositoryName = React.forwardRef<
    HTMLSpanElement,
    RepositoryNameProps
>(({
    repoName,
    displayMode = 'truncate',
    maxLength = 50,
    className,
    tooltipSide = 'top',
    showTooltip = true,
    customTooltipContent,
    ...props
}, ref) => {
    const renderContent = () => {
        switch (displayMode) {
            case 'breadcrumb': {
                const { parts, isCollapsed, fullParts } = createBreadcrumbRepoDisplay(repoName);
                return (
                    <Breadcrumb>
                        <BreadcrumbList className="flex-nowrap">
                            {parts.map((part, index) => (
                                <React.Fragment key={index}>
                                    {index > 0 && <BreadcrumbSeparator />}
                                    <BreadcrumbItem>
                                        {part === '…' ? (
                                            <BreadcrumbEllipsis />
                                        ) : (
                                            <span className="font-mono text-sm">{part}</span>
                                        )}
                                    </BreadcrumbItem>
                                </React.Fragment>
                            ))}
                        </BreadcrumbList>
                    </Breadcrumb>
                );
            }
            
            case 'project-only': {
                const projectName = getProjectName(repoName);
                return (
                    <span className="font-mono text-sm">
                        {projectName.length > maxLength 
                            ? projectName.substring(0, maxLength - 1) + '…'
                            : projectName
                        }
                    </span>
                );
            }
            
            case 'compact': {
                const { displayText } = createCompactRepoDisplay(repoName, maxLength);
                return <span className="font-mono text-sm">{displayText}</span>;
            }
            
            case 'truncate':
            default: {
                const { displayText } = createTruncatedRepoDisplay(repoName, maxLength);
                return <span className="font-mono text-sm">{displayText}</span>;
            }
        }
    };

    const content = (
        <span
            ref={ref}
            className={cn("inline-flex items-center", className)}
            {...props}
        >
            {renderContent()}
        </span>
    );

    // Only show tooltip if content is truncated or explicitly requested
    const shouldShowTooltip = showTooltip && (
        customTooltipContent ||
        displayMode === 'breadcrumb' ||
        displayMode === 'project-only' ||
        repoName.length > maxLength ||
        repoName !== content.props.children.props.children
    );

    if (!shouldShowTooltip) {
        return content;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {content}
            </TooltipTrigger>
            <TooltipContent side={tooltipSide} className="max-w-sm">
                {customTooltipContent || (
                    <div className="space-y-1">
                        <p className="font-mono text-sm">{repoName}</p>
                    </div>
                )}
            </TooltipContent>
        </Tooltip>
    );
});

RepositoryName.displayName = "RepositoryName"; 