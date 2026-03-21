'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import useCaptureEvent from '@/hooks/useCaptureEvent';
import { cn, getShortenedNumberDisplayString } from '@/lib/utils';
import isEqual from "fast-deep-equal/react";
import { useStickToBottom } from 'use-stick-to-bottom';
import { Brain, ChevronDown, ChevronRight, Clock, InfoIcon, Loader2, ScanSearchIcon, Zap } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { usePrevious } from '@uidotdev/usehooks';
import { SBChatMessageMetadata, SBChatMessagePart } from '../../types';
import { SearchScopeIcon } from '../searchScopeIcon';
import { MarkdownRenderer } from './markdownRenderer';
import { FindSymbolDefinitionsToolComponent } from './tools/findSymbolDefinitionsToolComponent';
import { FindSymbolReferencesToolComponent } from './tools/findSymbolReferencesToolComponent';
import { GrepToolComponent } from './tools/grepToolComponent';
import { ListCommitsToolComponent } from './tools/listCommitsToolComponent';
import { ListReposToolComponent } from './tools/listReposToolComponent';
import { ListTreeToolComponent } from './tools/listTreeToolComponent';
import { ReadFileToolComponent } from './tools/readFileToolComponent';
import { ToolLoadingGuard } from './tools/toolLoadingGuard';


interface DetailsCardProps {
    chatId: string;
    isExpanded: boolean;
    onExpandedChanged: (isExpanded: boolean) => void;
    isThinking: boolean;
    isStreaming: boolean;
    thinkingSteps: SBChatMessagePart[][];
    metadata?: SBChatMessageMetadata;
}

const ThinkingStepsScroller = ({ thinkingSteps, isStreaming, isThinking }: { thinkingSteps: SBChatMessagePart[][], isStreaming: boolean, isThinking: boolean }) => {
    const { scrollRef, contentRef, scrollToBottom } = useStickToBottom();
    const [shouldStick, setShouldStick] = useState(isThinking);
    const prevIsThinking = usePrevious(isThinking);

    useEffect(() => {
        if (prevIsThinking && !isThinking) {
            scrollToBottom();
            setShouldStick(false);
        } else if (!prevIsThinking && isThinking) {
            setShouldStick(true);
        }
    }, [isThinking, prevIsThinking, scrollToBottom]);

    return (
        <div ref={scrollRef} className="max-h-[300px] overflow-y-auto px-6 py-2">
            <div ref={shouldStick ? contentRef : undefined}>
                {thinkingSteps.length === 0 ? (
                    isStreaming ? (
                        <Skeleton className="h-24 w-full" />
                    ) : (
                        <p className="text-sm text-muted-foreground">No thinking steps</p>
                    )
                ) : thinkingSteps.map((step, index) => (
                    <div key={index}>
                        {step.map((part, index) => (
                            <div key={index} className="mb-2">
                                <StepPartRenderer part={part} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

const DetailsCardComponent = ({
    chatId,
    isExpanded,
    onExpandedChanged,
    isThinking,
    isStreaming,
    metadata,
    thinkingSteps,
}: DetailsCardProps) => {
    const captureEvent = useCaptureEvent();

    const handleExpandedChanged = useCallback((next: boolean) => {
        captureEvent('wa_chat_details_card_toggled', { chatId, isExpanded: next });
        onExpandedChanged(next);
    }, [chatId, captureEvent, onExpandedChanged]);

    return (
        <Card className="mb-4">
            <Collapsible open={isExpanded} onOpenChange={handleExpandedChanged}>
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
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex items-center text-xs cursor-help">
                                                        <Zap className="w-3 h-3 mr-1 flex-shrink-0" />
                                                        {getShortenedNumberDisplayString(metadata.totalTokens, 0)} tokens
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="bottom">
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-muted-foreground">Input</span>
                                                            <span>{metadata.totalInputTokens?.toLocaleString() ?? '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-muted-foreground">Output</span>
                                                            <span>{metadata.totalOutputTokens?.toLocaleString() ?? '—'}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4 border-t border-border pt-1">
                                                            <span className="text-muted-foreground">Total</span>
                                                            <span>{metadata.totalTokens.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        )}
                                        {metadata?.totalResponseTimeMs && (
                                            <div className="flex items-center text-xs">
                                                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                                                {Math.round(metadata.totalResponseTimeMs / 1000)} seconds
                                            </div>
                                        )}
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
                    <CardContent className="mt-2 p-0">
                        <ThinkingStepsScroller
                            thinkingSteps={thinkingSteps}
                            isStreaming={isStreaming}
                            isThinking={isThinking}
                        />
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    )
}

export const DetailsCard = memo(DetailsCardComponent, isEqual);


export const StepPartRenderer = ({ part }: { part: SBChatMessagePart }) => {
    switch (part.type) {
        case 'reasoning':
        case 'text':
            return (
                <MarkdownRenderer
                    content={part.text}
                    className="text-sm prose-p:m-0 prose-code:text-xs"
                />
            )
        case 'tool-read_file':
            return (
                <ToolLoadingGuard
                    part={part}
                    loadingText="Reading file..."
                >
                    {(output) => <ReadFileToolComponent {...output} />}
                </ToolLoadingGuard>
            )
        case 'tool-grep':
            return (
                <ToolLoadingGuard
                    part={part}
                    loadingText={'Searching...'}
                >
                    {(output) => <GrepToolComponent {...output} />}
                </ToolLoadingGuard>
            )
        case 'tool-find_symbol_definitions':
            return (
                <FindSymbolDefinitionsToolComponent
                    part={part}
                />
            )
        case 'tool-find_symbol_references':
            return (
                <FindSymbolReferencesToolComponent
                    part={part}
                />
            )
        case 'tool-list_repos':
            return (
                <ListReposToolComponent
                    part={part}
                />
            )
        case 'tool-list_commits':
            return (
                <ListCommitsToolComponent
                    part={part}
                />
            )
        case 'tool-list_tree':
            return (
                <ToolLoadingGuard
                    part={part}
                    loadingText="Listing tree..."
                >
                    {(output) => <ListTreeToolComponent {...output} />}
                </ToolLoadingGuard>
            )
        case 'data-source':
        case 'dynamic-tool':
        case 'file':
        case 'source-document':
        case 'source-url':
        case 'step-start':
            return null;
        default:
            // Guarantees this switch-case to be exhaustive
            part satisfies never;
            return null;
    }
}