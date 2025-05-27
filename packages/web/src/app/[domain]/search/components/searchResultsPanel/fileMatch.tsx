'use client';

import { useCallback, useMemo } from "react";
import { SearchResultFile, SearchResultChunk } from "@/features/search/types";
import { base64Decode } from "@/lib/utils";
import { useBrowseNavigation } from "@/app/[domain]/browse/hooks/useBrowseNavigation";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";


interface FileMatchProps {
    match: SearchResultChunk;
    file: SearchResultFile;
}

export const FileMatch = ({
    match,
    file,
}: FileMatchProps) => {
    const { navigateToPath } = useBrowseNavigation();

    const content = useMemo(() => {
        return base64Decode(match.content);
    }, [match.content]);

    const onOpen = useCallback(() => {
        const startLineNumber = match.contentStart.lineNumber;
        const endLineNumber = content.trimEnd().split('\n').length + startLineNumber - 1;

        navigateToPath({
            repoName: file.repository,
            revisionName: file.branches?.[0] ?? 'HEAD',
            path: file.fileName.text,
            pathType: 'blob',
            highlightRange: {
                start: {
                    lineNumber: startLineNumber,
                },
                end: {
                    lineNumber: endLineNumber,
                }
            }
        })
    }, []);

    // If it's just the title, don't show a code preview
    if (match.matchRanges.length === 0) {
        return null;
    }

    return (
        <div
            tabIndex={0}
            className="cursor-pointer focus:ring-inset focus:ring-4 bg-background hover:bg-accent"
            onKeyDown={(e) => {
                if (e.key !== "Enter") {
                    return;
                }
                onOpen();
            }}
            onClick={onOpen}
        >
            <LightweightCodeHighlighter
                language={file.language}
                highlightRanges={match.matchRanges}
                lineNumbers={true}
                lineNumbersOffset={match.contentStart.lineNumber}
                renderWhitespace={true}
            >
                {content}
            </LightweightCodeHighlighter>
        </div>
    );
}