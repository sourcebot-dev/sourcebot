'use client';

import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle, ChevronDown, ChevronRight, Clock, Cpu, InfoIcon, Loader2, Zap } from 'lucide-react';
import { CSSProperties, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed';
import { ANSWER_TAG } from '../../constants';
import { Reference, referenceSchema, SBChatMessage, SBChatMessageMetadata, Source } from "../../types";
import { useExtractReferences } from '../../useExtractReferences';
import { getAnswerPartFromAssistantMessage, groupMessageIntoSteps } from '../../utils';
import { AnswerCard } from './answerCard';
import { MarkdownRenderer, REFERENCE_PAYLOAD_ATTRIBUTE } from './markdownRenderer';
import { ReferencedSourcesListView } from './referencedSourcesListView';
import { FindSymbolDefinitionsToolComponent } from './tools/findSymbolDefinitionsToolComponent';
import { FindSymbolReferencesToolComponent } from './tools/findSymbolReferencesToolComponent';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';

interface ChatThreadListItemProps {
    userMessage: SBChatMessage;
    assistantMessage?: SBChatMessage;
    isStreaming: boolean;
    sources: Source[];
    chatId: string;
}

export const ChatThreadListItem = forwardRef<HTMLDivElement, ChatThreadListItemProps>(({
    userMessage,
    assistantMessage,
    isStreaming,
    sources,
    chatId,
}, ref) => {
    const leftPanelRef = useRef<HTMLDivElement>(null);
    const [leftPanelHeight, setLeftPanelHeight] = useState<number | null>(null);
    const markdownRendererRef = useRef<HTMLDivElement>(null);

    const [hoveredReference, setHoveredReference] = useState<Reference | undefined>(undefined);
    const [selectedReference, setSelectedReference] = useState<Reference | undefined>(undefined);
    const references = useExtractReferences(assistantMessage);
    const [isDetailsPanelExpanded, _setIsDetailsPanelExpanded] = useState(true);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);


    const userQuestion = useMemo(() => {
        return userMessage.parts.length > 0 && userMessage.parts[0].type === 'text' ? userMessage.parts[0].text : '';
    }, [userMessage]);

    const messageMetadata = useMemo((): SBChatMessageMetadata | undefined => {
        return assistantMessage?.metadata;
    }, [assistantMessage?.metadata]);

    const answerPart = useMemo(() => {
        if (!assistantMessage) {
            return undefined;
        }

        return getAnswerPartFromAssistantMessage(assistantMessage, isStreaming);
    }, [assistantMessage, isStreaming]);


    const thinkingSteps = useMemo(() => {
        const steps = groupMessageIntoSteps(assistantMessage?.parts ?? []);
        // Filter out the answerPart and empty steps
        return steps.map(step => step.filter(part => part !== answerPart)).filter(step => step.length > 0);
    }, [answerPart, assistantMessage?.parts]);

    // "thinking" is when the agent is generating output that is not the answer.
    const isThinking = useMemo(() => {
        return isStreaming && !answerPart
    }, [answerPart, isStreaming]);


    // Auto-collapse when answer first appears, but only once and respect user preference
    useEffect(() => {
        if (answerPart && !hasAutoCollapsed.current && !userHasManuallyExpanded.current) {
            _setIsDetailsPanelExpanded(false);
            hasAutoCollapsed.current = true;
        }
    }, [answerPart]);

    const onExpandDetailsPanel = useCallback((expanded: boolean) => {
        _setIsDetailsPanelExpanded(expanded);
        // If user manually expands after auto-collapse, remember their preference
        if (expanded && hasAutoCollapsed.current) {
            userHasManuallyExpanded.current = true;
        }
    }, []);


    // Measure answer content height for dynamic sizing
    useEffect(() => {
        if (!leftPanelRef.current || !answerPart) {
            setLeftPanelHeight(null);
            return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setLeftPanelHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(leftPanelRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [answerPart]);

    const rightPanelStyle: CSSProperties = useMemo(() => {
        const maxHeight = 'calc(100vh - 215px)';

        return {
            height: leftPanelHeight ? `min(${leftPanelHeight}px, ${maxHeight})` : maxHeight,
        };
    }, [leftPanelHeight]);


    useEffect(() => {
        if (!markdownRendererRef.current) {
            return;
        }

        const markdownRenderer = markdownRendererRef.current;

        const handleMouseOver = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute(REFERENCE_PAYLOAD_ATTRIBUTE)) {
                try {
                    const jsonPayload = JSON.parse(decodeURIComponent(target.getAttribute(REFERENCE_PAYLOAD_ATTRIBUTE) ?? '{}'));
                    const reference = referenceSchema.parse(jsonPayload);
                    setHoveredReference(reference);
                } catch (error) {
                    console.error(error);
                }
            }
        };

        const handleMouseOut = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute(REFERENCE_PAYLOAD_ATTRIBUTE)) {
                setHoveredReference(undefined);
            }
        };

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute(REFERENCE_PAYLOAD_ATTRIBUTE)) {
                try {
                    const jsonPayload = JSON.parse(decodeURIComponent(target.getAttribute(REFERENCE_PAYLOAD_ATTRIBUTE) ?? '{}'));
                    const reference = referenceSchema.parse(jsonPayload);
                    setSelectedReference(reference.id === selectedReference?.id ? undefined : reference);
                } catch (error) {
                    console.error(error);
                }
            }
        };

        markdownRenderer.addEventListener('mouseover', handleMouseOver);
        markdownRenderer.addEventListener('mouseout', handleMouseOut);
        markdownRenderer.addEventListener('click', handleClick);

        return () => {
            markdownRenderer.removeEventListener('mouseover', handleMouseOver);
            markdownRenderer.removeEventListener('mouseout', handleMouseOut);
            markdownRenderer.removeEventListener('click', handleClick);
        };
    }, [answerPart, selectedReference?.id]); // Re-run when answerPart changes to ensure we catch new content


    useEffect(() => {
        if (!selectedReference) {
            return;
        }

        const referenceElement = document.getElementById(`user-content-${selectedReference.id}`);
        if (!referenceElement) {
            return;
        }

        scrollIntoView(referenceElement, {
            behavior: 'smooth',
            scrollMode: 'if-needed',
            block: 'center',
        });

        referenceElement.classList.add('chat-reference--selected');

        return () => {
            referenceElement.classList.remove('chat-reference--selected');
        };
    }, [selectedReference]);

    useEffect(() => {
        if (!hoveredReference) {
            return;
        }

        const referenceElement = document.getElementById(`user-content-${hoveredReference.id}`);
        if (!referenceElement) {
            return;
        }

        referenceElement.classList.add('chat-reference--hover');

        return () => {
            referenceElement.classList.remove('chat-reference--hover');
        };
    }, [hoveredReference]);


    return (
        <div
            className="flex flex-col md:flex-row relative min-h-[calc(100vh-250px)]"
            ref={ref}
        >
            <ResizablePanelGroup
                direction="horizontal"
                style={{
                    height: 'auto',
                    overflow: 'visible',
                }}
            >
                <ResizablePanel
                    order={1}
                    minSize={30}
                    maxSize={70}
                    defaultSize={50}
                    style={{
                        overflow: 'visible',
                    }}
                >
                    <div
                        ref={leftPanelRef}
                        className="py-4 h-full"
                    >
                        <div className="flex flex-row gap-2 mb-4">
                            {isStreaming ? (
                                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-1.5" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0 mt-1.5" />
                            )}
                            <MarkdownRenderer
                                content={`**${userQuestion.trim()}**`}
                                isStreaming={false}
                                className="prose-p:m-0"
                            />
                        </div>

                        {isThinking && (
                            <div className="space-y-4 mb-4">
                                <Skeleton className="h-4 max-w-32" />
                                <div className="space-y-2">
                                    <Skeleton className="h-3 max-w-72" />
                                    <Skeleton className="h-3 max-w-64" />
                                    <Skeleton className="h-3 max-w-56" />
                                </div>
                            </div>
                        )}

                        <Card className="mb-4">
                            <Collapsible open={isDetailsPanelExpanded} onOpenChange={onExpandDetailsPanel}>
                                <CollapsibleTrigger asChild>
                                    <CardContent
                                        className={cn("p-3 cursor-pointer hover:bg-muted", {
                                            "rounded-lg": !isDetailsPanelExpanded,
                                            "rounded-t-lg": isDetailsPanelExpanded,
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
                                                        {messageMetadata?.modelName && (
                                                            <div className="flex items-center text-xs">
                                                                <Cpu className="w-3 h-3 mr-1 flex-shrink-0" />
                                                                {messageMetadata?.modelName}
                                                            </div>
                                                        )}
                                                        {messageMetadata?.totalTokens && (
                                                            <div className="flex items-center text-xs">
                                                                <Zap className="w-3 h-3 mr-1 flex-shrink-0" />
                                                                {messageMetadata?.totalTokens} tokens
                                                            </div>
                                                        )}
                                                        {messageMetadata?.totalResponseTimeMs && (
                                                            <div className="flex items-center text-xs">
                                                                <Clock className="w-3 h-3 mr-1 flex-shrink-0" />
                                                                {messageMetadata?.totalResponseTimeMs / 1000} seconds
                                                            </div>
                                                        )}
                                                        <div className="flex items-center text-xs">
                                                            <Brain className="w-3 h-3 mr-1 flex-shrink-0" />
                                                            {`${thinkingSteps.length} step${thinkingSteps.length === 1 ? '' : 's'}`}
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {isDetailsPanelExpanded ? (
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
                                                                        isStreaming={isStreaming}
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


                        {/* Answer section */}
                        {(answerPart && assistantMessage) ? (
                            <AnswerCard
                                ref={markdownRendererRef}
                                answerText={answerPart.text.replace(ANSWER_TAG, '').trim()}
                                chatId={chatId}
                                messageId={assistantMessage.id}
                                feedback={messageMetadata?.feedback?.type}
                            />
                        ) : !isStreaming && (
                            <p className="text-destructive">Error: No answer response was provided</p>
                        )}
                    </div>
                </ResizablePanel>
                <AnimatedResizableHandle className='mx-4' />
                <ResizablePanel
                    order={2}
                    minSize={30}
                    maxSize={70}
                    defaultSize={50}
                    style={{
                        overflow: 'visible',
                        position: 'relative',
                    }}
                >
                    <div
                        className="sticky top-0"
                    >
                        {references.length > 0 ? (
                            <ReferencedSourcesListView
                                references={references}
                                sources={sources}
                                hoveredReference={hoveredReference}
                                selectedReference={selectedReference}
                                onSelectedReferenceChanged={setSelectedReference}
                                onHoveredReferenceChanged={setHoveredReference}
                                style={rightPanelStyle}
                            />
                        ) : isStreaming ? (
                            <div className="space-y-4">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} className="w-full h-48" />
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                No file references found
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
});

ChatThreadListItem.displayName = 'ChatThreadListItem';