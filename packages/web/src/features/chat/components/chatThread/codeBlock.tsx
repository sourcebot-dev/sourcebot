'use client';

import { LightweightCodeHighlighter } from '@/app/[domain]/components/lightweightCodeHighlighter';
import { cn } from '@/lib/utils';
import { DoubleArrowDownIcon, DoubleArrowUpIcon } from '@radix-ui/react-icons';
import { useMemo, useState } from 'react';

interface CodeBlockComponentProps {
    code: string;
    language?: string;
}

const MAX_LINES_TO_DISPLAY = 14;

export const CodeBlock = ({
    code,
    language = "text",
}: CodeBlockComponentProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const lineCount = useMemo(() => {
        return code.split('\n').length;
    }, [code]);

    const isExpandButtonVisible = useMemo(() => {
        return lineCount > MAX_LINES_TO_DISPLAY;
    }, [lineCount]);

    return (
        <div className="flex flex-col rounded-md border overflow-hidden not-prose my-4">
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    {
                        "max-h-[350px]": !isExpanded && isExpandButtonVisible, // Roughly 14 lines
                        "max-h-none": isExpanded || !isExpandButtonVisible
                    }
                )}
            >
                <LightweightCodeHighlighter
                    language={language}
                    lineNumbers={true}
                    renderWhitespace={true}
                >
                    {code}
                </LightweightCodeHighlighter>
            </div>
            {isExpandButtonVisible && (
                <div
                    tabIndex={0}
                    className="flex flex-row items-center justify-center w-full bg-accent py-1 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={() => setIsExpanded(!isExpanded)}
                    onKeyDown={(e) => {
                        if (e.key !== "Enter") {
                            return;
                        }
                        setIsExpanded(!isExpanded);
                    }}
                >
                    {isExpanded ? <DoubleArrowUpIcon className="w-3 h-3" /> : <DoubleArrowDownIcon className="w-3 h-3" />}
                    <span className="text-sm ml-1">{isExpanded ? 'Show less' : 'Show more'}</span>
                </div>
            )}
        </div>
    );
};
