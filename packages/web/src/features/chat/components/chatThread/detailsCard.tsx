'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Brain, ChevronDown, ChevronRight, Clock, InfoIcon, Loader2, List, ScanSearchIcon, Zap } from 'lucide-react';
import { memo } from 'react';
import { MarkdownRenderer } from './markdownRenderer';
import { FindSymbolDefinitionsToolComponent } from './tools/findSymbolDefinitionsToolComponent';
import { FindSymbolReferencesToolComponent } from './tools/findSymbolReferencesToolComponent';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';
import { ListReposToolComponent } from './tools/listReposToolComponent';
import { SBChatMessageMetadata, SBChatMessagePart } from '../../types';
import { SearchScopeIcon } from '../searchScopeIcon';
import isEqual from "fast-deep-equal/react";


interface DetailsCardProps {
    isExpanded: boolean;
    onExpandedChanged: (isExpanded: boolean) => void;
    isThinking: boolean;
    isStreaming: boolean;
    thinkingSteps: SBChatMessagePart[][];
    metadata?: SBChatMessageMetadata;
}

const DetailsCardComponent = ({
    isExpanded,
    onExpandedChanged,
    isThinking,
    isStreaming,
    metadata,
    thinkingSteps,
}: DetailsCardProps) => {
    return (
        <Card className="mb-4">
            <Collapsible open={isExpanded} onOpenChange={onExpandedChanged}>
                <CollapsibleTrigger asChild>
                    <CardContent
                        className={cn("p-3 cursor-pointer hover:bg-muted", {
                            "rounded-lg": !isExpanded,
                            "rounded-t-lg": isExpanded,
                        })}
                    >
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-4">

                                <p className="flex items-center font-semibold text-muted-foreground text-sm">
                                    {isThinking ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin mr-1 flex-shrink-0" />
                                            Thinking...
                                        </>
                                    ) : (
                                        <>
                                            <InfoIcon className="w-4 h-4 mr-1 flex-shrink-0" />
                                            Details
                                        </>
                                    )}
                                </p>
                                {!isStreaming && (
                                    <>
                                        <Separator orientation="vertical" className="h-4" />
                                        {(metadata?.selectedSearchScopes && metadata.selectedSearchScopes.length > 0) && (
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center text-xs cursor-help">
                                                        <ScanSearchIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                                                        {metadata.selectedSearchScopes.length} search scope{metadata.selectedSearchScopes.length === 1 ? '' : 's'}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">
                                                    <div className="max-w-xs">
                                                        <div className="space-y-2">
                                                            {metadata.selectedSearchScopes.map((item) => (
                                                                <div key={item.value} className="flex items-center gap-2 text-xs">
                                                                    <SearchScopeIcon searchScope={item} className="h-3 w-3" />
                                                                    <span>{item.name}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {metadata?.modelName && (
                                            <div className="flex items-center text-xs">
                                                <Brain className="w-3 h-3 mr-1 flex-shrink-0" />
                                                {metadata?.modelName}
                                            </div>
                                        )}
                                        {metadata?.totalTokens && (
                                            <div className="flex items-center text-xs">
                                                <Zap className="w-3 h-3 mr-1 flex-shrink-0" />
                                                {metadata?.totalTokens} tokens
                                            </div>
                                        )}
                                        {metadata?.totalResponseTimeMs && (
                                            <div className="flex items-center text-xs">
                                                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                                                {metadata?.totalResponseTimeMs / 1000} seconds
                                            </div>
                                        )}
                                        <div className="flex items-center text-xs">
                                            <List className="w-3 h-3 mr-1 flex-shrink-0" />
                                            {`${thinkingSteps.length} step${thinkingSteps.length === 1 ? '' : 's'}`}
                                        </div>
                                    </>
                                )}
                            </div>

                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                        </div>
                    </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <CardContent className="mt-2 space-y-6">
                        {thinkingSteps.length === 0 ? (
                            isStreaming ? (
                                <Skeleton className="h-24 w-full" />
                            ) : (
                                <p className="text-sm text-muted-foreground">No thinking steps</p>
                            )
                        ) : thinkingSteps.map((step, index) => {
                            return (
                                <div
                                    key={index}
                                    className="border-l-2 pl-4 relative border-muted"
                                >
                                    <div
                                        className={`absolute left-[-9px] top-1 w-4 h-4 rounded-full flex items-center justify-center bg-muted`}
                                    >
                                        <span
                                            className={`text-xs font-semibold`}
                                        >
                                            {index + 1}
                                        </span>
                                    </div>
                                    {step.map((part, index) => {
                                        switch (part.type) {
                                            case 'reasoning':
                                            case 'text':
                                                return (
                                                    <MarkdownRenderer
                                                        key={index}
                                                        content={part.text}
                                                        className="text-sm"
                                                    />
                                                )
                                            case 'tool-readFiles':
                                                return (
                                                    <ReadFilesToolComponent
                                                        key={index}
                                                        part={part}
                                                    />
                                                )
                                            case 'tool-searchCode':
                                                return (
                                                    <SearchCodeToolComponent
                                                        key={index}
                                                        part={part}
                                                    />
                                                )
                                            case 'tool-findSymbolDefinitions':
                                                return (
                                                    <FindSymbolDefinitionsToolComponent
                                                        key={index}
                                                        part={part}
                                                    />
                                                )
                                            case 'tool-findSymbolReferences':
                                                return (
                                                    <FindSymbolReferencesToolComponent
                                                        key={index}
                                                        part={part}
                                                    />
                                                )
                                            case 'tool-listRepos':
                                                return (
                                                    <ListReposToolComponent
                                                        key={index}
                                                        part={part}
                                                    />
                                                )
                                            default:
                                                return null;
                                        }
                                    })}
                                </div>
                            )
                        })}
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    )
}

export const DetailsCard = memo(DetailsCardComponent, isEqual);