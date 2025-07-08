'use client';

import { AnswerToolUIPart } from "@/features/chat/tools";
import { useMemo } from "react";
import { MarkdownRenderer } from "../markdownRenderer";
import { cn } from "@/lib/utils";

export const AnswerToolComponent = ({ part }: { part: AnswerToolUIPart }) => {
    const label = useMemo(() => {
        switch (part.state) {
            case 'input-streaming':
                return 'Preparing answer...';
            case 'input-available':
                return 'Answer';
            case 'output-error':
                return 'Failed to provide answer';
            case 'output-available':
                return 'Answer';
        }
    }, [part]);

    const isComplete = part.state === 'output-available';

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className={cn('text-sm font-medium', {
                    'font-semibold': isComplete,
                })}>
                    {label}
                </span>
            </div>

            {part.state === 'output-error' ? (
                <p className="text-red-600 text-sm">
                    Failed to provide answer. Please try again.
                </p>
            ) : (
                <MarkdownRenderer
                    content={part.input?.answer ?? ''}
                    isStreaming={false}
                    className="prose prose-sm max-w-none"
                />
            )}
        </div>
    );
}; 