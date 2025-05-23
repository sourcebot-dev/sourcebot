'use client';

import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import { SourceRange } from "@/features/search/types";

interface CodePreviewProps {
    content: string,
    language: string,
    ranges: SourceRange[],
    lineOffset: number,
}

export const CodePreview = ({
    content,
    language,
    ranges,
    lineOffset,
}: CodePreviewProps) => {
    
    return (
        <LightweightCodeHighlighter
            language={language}
            highlightRanges={ranges}
            lineNumbers={true}
            lineNumbersOffset={lineOffset + 1}
            renderWhitespace={true}
        >
            {content}
        </LightweightCodeHighlighter>
    )
}
