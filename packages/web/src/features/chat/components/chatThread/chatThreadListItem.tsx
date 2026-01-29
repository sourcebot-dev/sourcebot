'use client';

import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Loader2 } from 'lucide-react';
import { CSSProperties, forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed';
import { Reference, referenceSchema, SBChatMessage, Source } from "../../types";
import { useExtractReferences } from '../../useExtractReferences';
import { getAnswerPartFromAssistantMessage, groupMessageIntoSteps, repairReferences, tryResolveFileReference } from '../../utils';
import { AnswerCard } from './answerCard';
import { DetailsCard } from './detailsCard';
import { MarkdownRenderer, REFERENCE_PAYLOAD_ATTRIBUTE } from './markdownRenderer';
import { ReferencedSourcesListView } from './referencedSourcesListView';
import { uiVisiblePartTypes } from '../../constants';
import isEqual from "fast-deep-equal/react";

interface ChatThreadListItemProps {
    userMessage: SBChatMessage;
    assistantMessage?: SBChatMessage;
    isStreaming: boolean;
    sources: Source[];
    chatId: string;
    index: number;
}

const ChatThreadListItemComponent = forwardRef<HTMLDivElement, ChatThreadListItemProps>(({
    userMessage,
    assistantMessage: _assistantMessage,
    isStreaming,
    sources,
    chatId,
    index,
}, ref) => {
    const leftPanelRef = useRef<HTMLDivElement>(null);
    const [leftPanelHeight, setLeftPanelHeight] = useState<number | null>(null);
    const answerRef = useRef<HTMLDivElement>(null);

    const [hoveredReference, setHoveredReference] = useState<Reference | undefined>(undefined);
    const [selectedReference, setSelectedReference] = useState<Reference | undefined>(undefined);
    const [isDetailsPanelExpanded, _setIsDetailsPanelExpanded] = useState(isStreaming);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);

    const userQuestion = useMemo(() => {
        return userMessage.parts.length > 0 && userMessage.parts[0].type === 'text' ? userMessage.parts[0].text : '';
    }, [userMessage]);

    // Take the assistant message and repair any references that are not properly formatted.
    // This applies to parts that are text (i.e., text & reasoning).
    const assistantMessage = useMemo(() => {
        if (!_assistantMessage) {
            return undefined;
        }

        return {
            ..._assistantMessage,
            ...(_assistantMessage.parts ? {
                parts: _assistantMessage.parts.map(part => {
                    switch (part.type) {
                        case 'text':
                        case 'reasoning':
                            return {
                                ...part,
                                text: repairReferences(part.text),
                            }
                        default:
                            return part;
                    }
                }),
            } : {}),
        } satisfies SBChatMessage;
    }, [_assistantMessage]);

    const answerPart = useMemo(() => {
        if (!assistantMessage) {
            return undefined;
        }

        return getAnswerPartFromAssistantMessage(assistantMessage, isStreaming);
    }, [assistantMessage, isStreaming]);


    // Groups parts into steps that are associated with thinking steps that
    // should be visible to the user. By "steps", we mean parts that originated
    // from the same LLM invocation. By "visibile", we mean parts that have some
    // visual representation in the UI (e.g., text, reasoning, tool calls, etc.).
    const uiVisibleThinkingSteps = useMemo(() => {
        const steps = groupMessageIntoSteps(assistantMessage?.parts ?? []);

        // Filter out the answerPart and empty steps
        return steps
            .map(
                (step) => step
                    // First, filter out any parts that are not text
                    .filter((part) => {
                        if (part.type !== 'text') {
                            return true;
                        }

                        return part.text !== answerPart?.text;
                    })
                    .filter((part) => {
                        return uiVisiblePartTypes.includes(part.type);
                    })
            )
            // Then, filter out any steps that are empty
            .filter(step => step.length > 0);
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

    // Handles mouse over and click events on reference elements, syncing these events
    // with the `hoveredReference` and `selectedReference` state.
    useEffect(() => {
        if (!answerRef.current) {
            return;
        }

        const markdownRenderer = answerRef.current;

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

    // When the selected reference changes, highlight all associated reference elements
    // and scroll to the nearest one, if needed.
    useEffect(() => {
        if (!selectedReference) {
            return;
        }

        // The reference id is attached to the DOM element as a class name.
        // @see: markdownRenderer.tsx
        const referenceElements = Array.from(answerRef.current?.getElementsByClassName(selectedReference.id) ?? []);
        if (referenceElements.length === 0) {
            return;
        }

        const nearestReferenceElement = getNearestReferenceElement(referenceElements);
        scrollIntoView(nearestReferenceElement, {
            behavior: 'smooth',
            scrollMode: 'if-needed',
            block: 'center',
        });

        referenceElements.forEach(element => {
            // Check if it's an inline chat citation or code viewer element
            const isInlineCitation = element.classList.contains('bg-chat-citation');
            const selectedClass = isInlineCitation ? 'chat-citation--selected' : 'chat-reference--selected';
            element.classList.add(selectedClass);
        });

        return () => {
            referenceElements.forEach(element => {
                // Remove both possible selected classes
                element.classList.remove('chat-reference--selected');
                element.classList.remove('chat-citation--selected');
            });
        };
    }, [selectedReference]);

    // When the hovered reference changes, highlight all associated reference elements.
    useEffect(() => {
        if (!hoveredReference) {
            return;
        }

        // The reference id is attached to the DOM element as a class name.
        // @see: markdownRenderer.tsx
        const referenceElements = Array.from(answerRef.current?.getElementsByClassName(hoveredReference.id) ?? []);
        if (referenceElements.length === 0) {
            return;
        }

        referenceElements.forEach(element => {
            // Check if it's an inline chat citation or code viewer element
            const isInlineCitation = element.classList.contains('bg-chat-citation');
            const hoverClass = isInlineCitation ? 'chat-citation--hover' : 'chat-reference--hover';
            element.classList.add(hoverClass);
        });

        return () => {
            referenceElements.forEach(element => {
                // Remove both possible hover classes
                element.classList.remove('chat-reference--hover');
                element.classList.remove('chat-citation--hover');
            });
        };
    }, [hoveredReference]);

    const references = useExtractReferences(answerPart);

    // Extract the file sources that are referenced by the answer part.
    const referencedFileSources = useMemo(() => {
        const fileSources = sources.filter((source) => source.type === 'file');

        return references
            .filter((reference) => reference.type === 'file')
            .map((reference) => tryResolveFileReference(reference, fileSources))
            .filter((file) => file !== undefined)
            // de-duplicate files
            .filter((file, index, self) =>
                index === self.findIndex((t) =>
                    t?.path === file?.path
                    && t?.repo === file?.repo
                    && t?.revision === file?.revision
                )
            );
    }, [references, sources]);


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
                                content={userQuestion.trim()}
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

                        <DetailsCard
                            isExpanded={isDetailsPanelExpanded}
                            onExpandedChanged={onExpandDetailsPanel}
                            isThinking={isThinking}
                            isStreaming={isStreaming}
                            thinkingSteps={uiVisibleThinkingSteps}
                            metadata={assistantMessage?.metadata}
                        />

                        {(answerPart && assistantMessage) ? (
                            <AnswerCard
                                ref={answerRef}
                                answerText={answerPart.text}
                                chatId={chatId}
                                messageId={assistantMessage.id}
                                traceId={assistantMessage.metadata?.traceId}
                                sources={sources.filter((source) => source.type === 'file')}
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
                        {referencedFileSources.length > 0 ? (
                            <ReferencedSourcesListView
                                index={index}
                                references={references}
                                sources={referencedFileSources}
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

ChatThreadListItemComponent.displayName = 'ChatThreadListItem';

// Custom comparison function that handles the known issue where useChat mutates
// message objects in place during streaming, causing fast-deep-equal to return
// true even when content changes (because it checks reference equality first).
// See: https://github.com/vercel/ai/issues/6466
const arePropsEqual = (
    prevProps: ChatThreadListItemProps,
    nextProps: ChatThreadListItemProps
): boolean => {
    // Always re-render if streaming status changes
    if (prevProps.isStreaming !== nextProps.isStreaming) {
        return false;
    }

    // If currently streaming, always allow re-render
    // This bypasses the fast-deep-equal reference check issue when useChat
    // mutates message objects in place during token streaming
    if (nextProps.isStreaming) {
        return false;
    }

    // For non-streaming messages, use deep equality
    // At this point, useChat should have finished and created final objects
    return isEqual(prevProps, nextProps);
};

export const ChatThreadListItem = memo(ChatThreadListItemComponent, arePropsEqual);

// Finds the nearest reference element to the viewport center.
const getNearestReferenceElement = (referenceElements: Element[]) => {
    return referenceElements.reduce((nearest, current) => {
        if (!nearest) return current;

        const nearestRect = nearest.getBoundingClientRect();
        const currentRect = current.getBoundingClientRect();

        // Calculate distance from element center to viewport center
        const viewportCenter = window.innerHeight / 2;
        const nearestDistance = Math.abs((nearestRect.top + nearestRect.bottom) / 2 - viewportCenter);
        const currentDistance = Math.abs((currentRect.top + currentRect.bottom) / 2 - viewportCenter);

        return currentDistance < nearestDistance ? current : nearest;
    });
}