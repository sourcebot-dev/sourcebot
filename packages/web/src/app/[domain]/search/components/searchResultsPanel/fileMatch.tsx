'use client';

import { useCallback } from "react";
import { SearchResultFile, SearchResultChunk } from "@/features/search/types";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";


interface FileMatchProps {
    match: SearchResultChunk;
    file: SearchResultFile;
    onOpen: (startLineNumber: number, endLineNumber: number, isCtrlKeyPressed: boolean) => void;
}

export const FileMatch = ({
    match,
    file,
    onOpen: _onOpen,
}: FileMatchProps) => {
    const onOpen = useCallback((isCtrlKeyPressed: boolean) => {
        const startLineNumber = match.contentStart.lineNumber;
        const endLineNumber = match.content.trimEnd().split('\n').length + startLineNumber - 1;

        _onOpen(startLineNumber, endLineNumber, isCtrlKeyPressed);
    }, [match.content, match.contentStart.lineNumber, _onOpen]);

    // If it's just the title, don't show a code preview
    if (match.matchRanges.length === 0) {
        return null;
    }

    return (
        <div
            tabIndex={0}
            className="cursor-pointer focus:ring-inset focus:ring-4 bg-background hover:bg-editor-lineHighlight"
            onKeyDown={(e) => {
                if (e.key !== "Enter") {
                    return;
                }

                onOpen(e.metaKey || e.ctrlKey);
            }}
            onClick={(e) => {
                onOpen(e.metaKey || e.ctrlKey);
            }}
            title="open file: click, open file preview: cmd/ctrl + click"
        >
            <LightweightCodeHighlighter
                language={file.language}
                highlightRanges={match.matchRanges}
                lineNumbers={true}
                lineNumbersOffset={match.contentStart.lineNumber}
                renderWhitespace={true}
            >
                {match.content}
            </LightweightCodeHighlighter>
        </div>
    );
}