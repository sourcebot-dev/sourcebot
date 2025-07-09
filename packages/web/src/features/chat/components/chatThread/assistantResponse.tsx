'use client';

import { Loader2, BookOpenIcon } from 'lucide-react';
import { memo, useMemo, useState, useEffect, useRef, CSSProperties } from 'react';
import { MarkdownRenderer } from './markdownRenderer';
import { ChatContext, SBChatMessage } from '../../types';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';
import { ToolHeader } from './tools/shared';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileReferencesList } from './fileReferencesList';
import { useExtractFileReferences } from '../../useExtractFileReferences';
import { TableOfContents } from './tableOfContents';

interface AssistantResponseProps {
    message: SBChatMessage;
    isStreaming: boolean;
    chatContext: ChatContext;
}

export const AssistantResponse = memo<AssistantResponseProps>(({ message, isStreaming, chatContext }) => {
    const [isResearchExpanded, setIsResearchExpanded] = useState(true);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);
    const markdownRendererRef = useRef<HTMLDivElement>(null);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const answerContainerRef = useRef<HTMLDivElement>(null);
    const [highlightedFileRange, setHighlightedFileRange] = useState<{
        fileName: string;
        startLine: number;
        endLine: number;
    } | undefined>(undefined);
    const [answerHeight, setAnswerHeight] = useState<number | null>(null);

    const fileReferences = useExtractFileReferences([message]);

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

    // Handle hover events on file reference spans for testing
    useEffect(() => {
        if (!markdownRendererRef.current) {
            return;
        }

        const markdownRenderer = markdownRendererRef.current;

        const handleMouseOver = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute('data-reference-id')) {
                const fileName = target.getAttribute('data-file-name');
                const startLineStr = target.getAttribute('data-start-line');
                const endLineStr = target.getAttribute('data-end-line');

                if (fileName && startLineStr && endLineStr) {
                    setHighlightedFileRange({
                        fileName: fileName.split('/').pop() ?? fileName,
                        startLine: parseInt(startLineStr),
                        endLine: parseInt(endLineStr),
                    });
                }
            }
        };

        const handleMouseOut = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.hasAttribute('data-reference-id')) {
                setHighlightedFileRange(undefined);
            }
        };

        markdownRenderer.addEventListener('mouseover', handleMouseOver);
        markdownRenderer.addEventListener('mouseout', handleMouseOut);

        return () => {
            markdownRenderer.removeEventListener('mouseover', handleMouseOver);
            markdownRenderer.removeEventListener('mouseout', handleMouseOut);
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
                                    // @todo
                                    break;
                                case 'tool-findSymbolReferences':
                                    // @todo
                                    break;
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
                            {(isStreaming && fileReferences.length === 0) ? (
                                <div className="animate-pulse space-y-4">
                                    <div className="h-4 w-1/4 bg-muted rounded" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-3/4 bg-muted rounded" />
                                        <div className="h-3 w-2/3 bg-muted rounded" />
                                        <div className="h-3 w-1/2 bg-muted rounded" />
                                    </div>
                                </div>
                            ): (
                                <ScrollArea 
                                    ref={scrollAreaRef}
                                    style={referenceViewerScrollAreaStyle}
                                >
                                    <FileReferencesList
                                        fileReferences={fileReferences}
                                        chatContext={chatContext}
                                        highlightedFileRange={highlightedFileRange}
                                    />
                                </ScrollArea>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
});

AssistantResponse.displayName = 'AssistantResponse';
