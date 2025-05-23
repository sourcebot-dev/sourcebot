'use client';

import { ReadOnlyCodeBlock } from "@/app/[domain]/components/readOnlyCodeBlock";
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
        <ReadOnlyCodeBlock
            language={language}
            highlightRanges={ranges}
            lineNumbers={true}
            lineNumbersOffset={lineOffset + 1}
            renderWhitespace={true}
        >
            {content}
        </ReadOnlyCodeBlock>
    )
}
