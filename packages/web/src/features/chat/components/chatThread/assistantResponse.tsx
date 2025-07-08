'use client';

import { Loader2, BookOpenIcon } from 'lucide-react';
import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './markdownRenderer';
import { SBChatMessage } from '../../types';
import { ReadFilesToolComponent } from './tools/readFilesToolComponent';
import { SearchCodeToolComponent } from './tools/searchCodeToolComponent';
import { AnswerToolComponent } from './tools/answerToolComponent';
import { ToolHeader } from './tools/shared';

interface AssistantResponseProps {
    message: SBChatMessage;
    isStreaming: boolean;
}

export const AssistantResponse = memo<AssistantResponseProps>(({ message, isStreaming }) => {
    const [isResearchExpanded, setIsResearchExpanded] = useState(true);
    const hasAutoCollapsed = useRef(false);
    const userHasManuallyExpanded = useRef(false);

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
    }, [isResearchActive]);

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


            <div className="p-4 border rounded-lg">
                {answerPart ? (
                    <AnswerToolComponent
                        part={answerPart}
                    />
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
        </div>
    )
});

AssistantResponse.displayName = 'AssistantResponse';
