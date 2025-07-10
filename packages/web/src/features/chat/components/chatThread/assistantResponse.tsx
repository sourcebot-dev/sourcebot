'use client';

import { Loader2, BookOpenIcon } from 'lucide-react';
import { memo, useMemo, useState, useEffect, useRef, CSSProperties } from 'react';
import { MarkdownRenderer, REFERENCE_PAYLOAD_ATTRIBUTE } from './markdownRenderer';
import { Source, SBChatMessage, referenceSchema, Reference } from '../../types';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';
import { ToolHeader } from './tools/shared';
import { ReferencedSourcesListView } from './referencedSourcesListView';
import { useExtractReferences } from '../../useExtractReferences';
import { TableOfContents } from './tableOfContents';
import { FindSymbolDefinitionsToolComponent } from './tools/findSymbolDefinitionsToolComponent';
import { FindSymbolReferencesToolComponent } from './tools/findSymbolReferencesToolComponent';

interface AssistantResponseProps {
    message: SBChatMessage;
    isStreaming: boolean;
    sources: Source[];
}

export const AssistantResponse = memo<AssistantResponseProps>(({ message, isStreaming, sources }) => {
    const [isResearchExpanded, setIsResearchExpanded] = useState(true);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);
    const markdownRendererRef = useRef<HTMLDivElement>(null);
    const answerContainerRef = useRef<HTMLDivElement>(null);
    const [answerHeight, setAnswerHeight] = useState<number | null>(null);

    const [highlightedReference, setHighlightedReference] = useState<Reference | undefined>(undefined);
    const [selectedReference, setSelectedReference] = useState<Reference | undefined>(undefined);

    const references = useExtractReferences(message);

    // Generate unique id for this message's answer content
    const answerId = `answer-${message.id}`;

    const answerPart = useMemo(() => {
        return message.parts
            .find((part) => part.type === 'tool-answerTool');
    }, [message.parts]);

    const researchParts = useMemo(() => {
        return message.parts.filter((part) => part.type !== 'tool-answerTool');
    }, [message.parts]);

    // Auto-collapse when answer first appears, but only once and respect user preference
    useEffect(() => {
        if (answerPart && !hasAutoCollapsed.current && !userHasManuallyExpanded.current) {
            setIsResearchExpanded(false);
            hasAutoCollapsed.current = true;
        }
    }, [answerPart]);

    const onExpandResearchSection = (expanded: boolean) => {
        setIsResearchExpanded(expanded);
        // If user manually expands after auto-collapse, remember their preference
        if (expanded && hasAutoCollapsed.current) {
            userHasManuallyExpanded.current = true;
        }
    };

    const isResearchActive = useMemo(() => {
        return isStreaming && !answerPart;
    }, [isStreaming, answerPart]);

    const researchLabel = useMemo(() => {
        if (isResearchActive) {
            return "Researching...";
        }

        if (message.metadata?.researchDuration) {
            const duration = message.metadata.researchDuration;
            const seconds = Math.round(duration / 1000) || 1;
            return `Research completed in ${seconds} second${seconds !== 1 ? 's' : ''}`;
        }

        return "Research completed";
    }, [isResearchActive, message.metadata?.researchDuration]);

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
                    const payload = referenceSchema.parse(jsonPayload);
                    setHighlightedReference(payload);
                } catch (error) {
                    console.error(error);
                }
            }
        };

        const handleMouseOut = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute(REFERENCE_PAYLOAD_ATTRIBUTE)) {
                setHighlightedReference(undefined);
            }
        };

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute(REFERENCE_PAYLOAD_ATTRIBUTE)) {
                try {
                    const jsonPayload = JSON.parse(decodeURIComponent(target.getAttribute(REFERENCE_PAYLOAD_ATTRIBUTE) ?? '{}'));
                    const payload = referenceSchema.parse(jsonPayload);
                    setSelectedReference(payload);
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
    }, [answerPart]); // Re-run when answerPart changes to ensure we catch new content

    // Measure answer content height for dynamic sizing
    useEffect(() => {
        if (!answerContainerRef.current || !answerPart) {
            setAnswerHeight(null);
            return;
        }

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setAnswerHeight(entry.contentRect.height);
            }
        });

        resizeObserver.observe(answerContainerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [answerPart]);

    const referenceViewerScrollAreaStyle: CSSProperties = useMemo(() => {
        const maxHeight = 'calc(100vh - 120px)';

        return {
            height: answerHeight ? `min(${answerHeight}px, ${maxHeight})` : maxHeight,
        };
    }, [answerHeight]);

    return (
        <div
            key={message.id}
            className="select-text"
        >
            <div className="mb-4">
                <ToolHeader
                    isLoading={isResearchActive}
                    isError={false}
                    isExpanded={isResearchExpanded}
                    label={researchLabel}
                    Icon={isResearchActive ? Loader2 : BookOpenIcon}
                    onExpand={onExpandResearchSection}
                />

                {isResearchExpanded && (
                    <div className="ml-2 border-l-2 border-muted pl-2 mt-2">
                        {researchParts.map((part, index) => {
                            switch (part.type) {
                                case 'reasoning':
                                case 'text':
                                    return (
                                        <MarkdownRenderer
                                            key={index}
                                            content={part.text}
                                            isStreaming={isStreaming}
                                            className="text-sm prose-p:text-muted-foreground prose-li:text-muted-foreground prose-li:marker:text-muted-foreground"
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
                )}
            </div>

            <div className="flex gap-4 relative">
                <div className="w-1/2 p-4 border rounded-lg" ref={answerContainerRef}>
                    {answerPart ? (
                        <div id={answerId}>
                            <MarkdownRenderer
                                ref={markdownRendererRef}
                                content={answerPart.input?.answer ?? ''}
                                isStreaming={false}
                                className="prose prose-sm max-w-none"
                            />
                        </div>
                    ) : isStreaming && (
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 w-1/4 bg-muted rounded" />
                            <div className="space-y-2">
                                <div className="h-3 w-3/4 bg-muted rounded" />
                                <div className="h-3 w-2/3 bg-muted rounded" />
                                <div className="h-3 w-1/2 bg-muted rounded" />
                            </div>
                        </div>
                    )}
                </div>

                {/* TOC positioned to the left and sticky to answer top */}
                {answerPart && (
                    <div className="absolute left-0 top-0 -translate-x-full pr-6 w-64 hidden xl:block h-full">
                        <div className="sticky top-0">
                            <TableOfContents
                                targetSelector={`#${answerId}`}
                                className="border rounded-lg p-4"
                            />
                        </div>
                    </div>
                )}

                {/* Reference viewer */}
                {answerPart && (
                    <div className="w-1/2">
                        <div className="sticky top-0">
                            {(isStreaming && references.length === 0) ? (
                                <div className="animate-pulse space-y-4">
                                    <div className="h-4 w-1/4 bg-muted rounded" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-3/4 bg-muted rounded" />
                                        <div className="h-3 w-2/3 bg-muted rounded" />
                                        <div className="h-3 w-1/2 bg-muted rounded" />
                                    </div>
                                </div>
                            ): (
                                <ReferencedSourcesListView
                                    references={references}
                                    sources={sources}
                                    highlightedReference={highlightedReference}
                                    selectedReference={selectedReference}
                                    style={referenceViewerScrollAreaStyle}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
});

AssistantResponse.displayName = 'AssistantResponse';
