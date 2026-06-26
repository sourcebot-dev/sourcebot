'use client';

import { AnimatedResizableHandle } from '@/components/ui/animatedResizableHandle';
import { ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Loader2 } from 'lucide-react';
import { CSSProperties, forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import scrollIntoView from 'scroll-into-view-if-needed';
import { Reference, referenceSchema, SBChatMessage, Source } from "@/features/chat/types";
import { useExtractReferences } from '../../useExtractReferences';
import { getAnswerPartFromAssistantMessage, getLastStepParts, getUserMessageAttachments, getUserMessageText, groupMessageIntoSteps, isSBChatToolPart, repairReferences } from '@/features/chat/utils';
import { AnswerCard } from './answerCard';
import { MessageAttachments } from './messageAttachments';
import { DetailsCard } from './detailsCard';
import { ApprovalRequestedToolPart, ToolApprovalBanner } from './toolApprovalBanner';
import { MarkdownRenderer, REFERENCE_PAYLOAD_ATTRIBUTE } from './markdownRenderer';
import { ReferencedSourcesListView } from './referencedSourcesListView';
import { useExtractPanelItems } from '../../useExtractPanelItems';
import { PanelContext, PanelContextValue, PanelSelection } from '../../panelContext';
import isEqual from "fast-deep-equal/react";
import { ANSWER_TAG } from '@/features/chat/constants';

interface ChatThreadListItemProps {
    userMessage: SBChatMessage;
    assistantMessage?: SBChatMessage;
    isTurnInProgress: boolean;
    isNetworkActive: boolean;
    isAwaitingToolApproval: boolean;
    sources: Source[];
    chatId: string;
    index: number;
}

const ChatThreadListItemComponent = forwardRef<HTMLDivElement, ChatThreadListItemProps>(({
    userMessage,
    assistantMessage: _assistantMessage,
    isTurnInProgress,
    isNetworkActive,
    isAwaitingToolApproval,
    sources,
    chatId,
    index,
}, ref) => {
    const leftPanelRef = useRef<HTMLDivElement>(null);
    const [leftPanelHeight, setLeftPanelHeight] = useState<number | null>(null);
    const answerRef = useRef<HTMLDivElement>(null);

    // Unified panel selection/hover: a single selection model shared by inline
    // file-reference citations and diagrams (see panelContext.ts). Only one
    // thing is selected/hovered at a time.
    const [selected, setSelected] = useState<PanelSelection | undefined>(undefined);
    const [hovered, setHovered] = useState<PanelSelection | undefined>(undefined);

    const selectedReference = useMemo(() => (selected?.kind === 'reference' ? selected.reference : undefined), [selected]);
    const hoveredReference = useMemo(() => (hovered?.kind === 'reference' ? hovered.reference : undefined), [hovered]);

    const setSelectedReference = useCallback((reference?: Reference) => {
        setSelected(reference ? { kind: 'reference', reference } : undefined);
    }, []);
    const setHoveredReference = useCallback((reference?: Reference) => {
        setHovered(reference ? { kind: 'reference', reference } : undefined);
    }, []);

    const [isDetailsPanelExpanded, _setIsDetailsPanelExpanded] = useState(isNetworkActive);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);

    const userQuestion = useMemo(() => {
        return getUserMessageText(userMessage);
    }, [userMessage]);

    const userAttachments = useMemo(() => {
        return getUserMessageAttachments(userMessage);
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

        return getAnswerPartFromAssistantMessage(assistantMessage, isTurnInProgress);
    }, [assistantMessage, isTurnInProgress]);


    // Groups parts into steps that are associated with thinking steps that
    // should be visible to the user. By "steps", we mean parts that originated
    // from the same LLM invocation. By "visibile", we mean parts that have some
    // visual representation in the UI (e.g., text, reasoning, tool calls, etc.).
    //
    // Each step is tagged with its stepIndex — the invocation's position in
    // the turn, which indexes into `metadata.stepTokenUsage`. Indices are
    // assigned by counting 'step-start' markers (one per invocation) BEFORE
    // any filtering, so dropping empty or answer-only steps below cannot
    // shift the indices of the steps that remain.
    const { uiVisibleThinkingSteps, answerStepIndex } = useMemo(() => {
        const groupedParts = groupMessageIntoSteps(assistantMessage?.parts ?? []);

        // Parts written before the first step-start (e.g. data parts) don't
        // belong to any step; they get stepIndex -1 and never survive the
        // visibility filters below.
        let stepIndex = -1;
        let answerStepIndex: number | undefined = undefined;

        const steps = groupedParts
            .map((stepParts) => {
                if (stepParts[0]?.type === 'step-start') {
                    stepIndex++;
                }

                if (stepParts.some((part) => part.type === 'text' && part.text.includes(ANSWER_TAG))) {
                    answerStepIndex = stepIndex;
                }

                return {
                    stepIndex,
                    parts: stepParts
                        // First, filter out the answer text
                        .filter((part) => {
                            if (part.type === 'text') {
                                return !part.text.includes(ANSWER_TAG);
                            }

                            return true;
                        })
                        .filter((part) => {
                            // Only include text, reasoning, and tool parts
                            return (
                                part.type === 'text' ||
                                part.type === 'reasoning' ||
                                part.type.startsWith('tool-') ||
                                part.type === 'dynamic-tool'
                            )
                        }),
                };
            })
            // Then, filter out any steps that are empty
            .filter((step) => step.parts.length > 0);

        return { uiVisibleThinkingSteps: steps, answerStepIndex };
    }, [assistantMessage?.parts]);

    // "thinking" is when the agent is generating output that is not the answer.
    const isThinking = useMemo(() => {
        return isNetworkActive && !answerPart
    }, [answerPart, isNetworkActive]);

    // Extract MCP tool parts that are waiting for user approval.
    const approvalRequestedParts = useMemo((): ApprovalRequestedToolPart[] => {
        if (!assistantMessage) {
            return [];
        }
        return getLastStepParts(assistantMessage.parts)
            .filter(isSBChatToolPart)
            .filter((part): part is ApprovalRequestedToolPart => part.state === 'approval-requested');
    }, [assistantMessage]);


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
        const maxHeight = 'calc(100vh - 215px - var(--banner-height, 0px))';

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
    const { diagrams, referencedFileSources, orderedItems } = useExtractPanelItems(answerPart, references, sources);

    // Maps a diagram id to its position in order of appearance (matches the
    // index the right panel assigns), used for the "Diagram N" label fallback.
    const diagramIndexById = useMemo(() => {
        return new Map(diagrams.map((diagram, i) => [diagram.id, i]));
    }, [diagrams]);

    // Reveal a diagram in the right panel: the panel list expands it and scrolls
    // it into view when the selection changes. Clearing first lets the same
    // diagram be re-revealed (re-clicking a chip re-scrolls).
    const revealDiagram = useCallback((diagramId: string) => {
        setSelected(undefined);
        requestAnimationFrame(() => setSelected({ kind: 'diagram', diagramId }));
    }, []);

    const setHoveredDiagram = useCallback((diagramId?: string) => {
        setHovered(diagramId ? { kind: 'diagram', diagramId } : undefined);
    }, []);

    const jumpToInlineDiagram = useCallback((diagramId: string) => {
        document.getElementById(`diagram-${diagramId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    const getDiagramIndex = useCallback((diagramId: string) => {
        return diagramIndexById.get(diagramId) ?? -1;
    }, [diagramIndexById]);

    const panelContextValue = useMemo<PanelContextValue>(() => ({
        chatId,
        isStreaming: isNetworkActive,
        setSelectedReference,
        setHoveredReference,
        revealDiagram,
        setHoveredDiagram,
        getDiagramIndex,
        jumpToInlineDiagram,
    }), [chatId, isNetworkActive, setSelectedReference, setHoveredReference, revealDiagram, setHoveredDiagram, getDiagramIndex, jumpToInlineDiagram]);

    const sourcesView = (
        <ReferencedSourcesListView
            index={index}
            references={references}
            sources={referencedFileSources}
            style={rightPanelStyle}
            orderedItems={orderedItems}
            selected={selected}
            hovered={hovered}
        />
    );

    return (
        <PanelContext.Provider value={panelContextValue}>
        <div
            className="flex flex-col md:flex-row relative min-h-[calc(100vh-250px-var(--banner-height,0px))]"
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
                        <div className="mb-4">
                            {userAttachments.length > 0 && (
                                <MessageAttachments attachments={userAttachments} className="mb-1.5 ml-6" />
                            )}

                            <div className="flex flex-row gap-2">
                                {isTurnInProgress ? (
                                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0 mt-1.5" />
                                ) : (
                                    <CheckCircle className="w-4 h-4 text-green-700 flex-shrink-0 mt-1.5" />
                                )}
                                <MarkdownRenderer
                                    content={userQuestion.trim()}
                                    className="prose-p:m-0"
                                    escapeHtml={true}
                                />
                            </div>
                        </div>

                        {isThinking && (
                            <div className="space-y-2 mb-4">
                                <Skeleton className="h-3 w-full max-w-80" />
                                <Skeleton className="h-3 w-full max-w-72" />
                                <Skeleton className="h-3 w-full max-w-56" />
                            </div>
                        )}

                        <DetailsCard
                            chatId={chatId}
                            isExpanded={isDetailsPanelExpanded}
                            onExpandedChanged={onExpandDetailsPanel}
                            isThinking={isThinking}
                            isTurnInProgress={isTurnInProgress}
                            isNetworkActive={isNetworkActive}
                            isAwaitingToolApproval={isAwaitingToolApproval}
                            thinkingSteps={uiVisibleThinkingSteps}
                            answerStepIndex={answerStepIndex}
                            metadata={assistantMessage?.metadata}
                        />

                        {approvalRequestedParts.length > 0 && (
                            <ToolApprovalBanner parts={approvalRequestedParts} />
                        )}

                        {(answerPart && assistantMessage) ? (
                            <AnswerCard
                                ref={answerRef}
                                answerText={answerPart.text}
                                chatId={chatId}
                                messageId={assistantMessage.id}
                                traceId={assistantMessage.metadata?.traceId}
                                sources={referencedFileSources}
                            />
                        ) : !isTurnInProgress && approvalRequestedParts.length === 0 && (
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
                        overflow: 'clip',
                        maxHeight: '100%',
                        minWidth: 0,
                    }}
                >
                    <div
                        className="sticky top-0"
                    >
                        {(referencedFileSources.length > 0 || diagrams.length > 0) ? (
                            sourcesView
                        ) : isNetworkActive ? (
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
        </PanelContext.Provider>
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
    // Always re-render if turn/network/approval status changes
    if (
        prevProps.isTurnInProgress !== nextProps.isTurnInProgress ||
        prevProps.isNetworkActive !== nextProps.isNetworkActive ||
        prevProps.isAwaitingToolApproval !== nextProps.isAwaitingToolApproval
    ) {
        return false;
    }

    // If currently network-active, always allow re-render
    // This bypasses the fast-deep-equal reference check issue when useChat
    // mutates message objects in place during token streaming
    if (nextProps.isNetworkActive) {
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
