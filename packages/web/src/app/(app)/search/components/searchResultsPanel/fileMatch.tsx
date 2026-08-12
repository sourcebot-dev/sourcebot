'use client';

import { SearchResultFile, SearchResultChunk } from "@/features/search";
import { LightweightCodeHighlighter } from "@/app/(app)/components/lightweightCodeHighlighter";
import Link from "next/link";
import { getBrowsePath } from "@/app/(app)/browse/hooks/utils";


interface FileMatchProps {
    match: SearchResultChunk;
    file: SearchResultFile;
    onOpenPreview: () => void;
}

export const FileMatch = ({
    match,
    file,
    onOpenPreview,
}: FileMatchProps) => {
    // If it's just the title, don't show a code preview
    if (match.matchRanges.length === 0) {
        return null;
    }

    return (
        <Link
            tabIndex={0}
            className="cursor-pointer focus:ring-inset focus:ring-4 bg-background hover:bg-editor-lineHighlight"
            prefetch={false}
            href={getBrowsePath({
                repoName: file.repository,
                revisionName: file.branches?.[0] ?? 'HEAD',
                path: file.fileName.text,
                pathType: 'blob',
                highlightRange: {
                    start: {
                        lineNumber: match.contentStart.lineNumber,
                    },
                    end: {
                        lineNumber: match.content.trimEnd().split('\n').length + match.contentStart.lineNumber - 1,
                    }
                }
            })}
            onClick={(event) => {
                if (!event.metaKey && !event.ctrlKey) {
                    return;
                }

                event.preventDefault();
                onOpenPreview();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Enter' || (!event.metaKey && !event.ctrlKey)) {
                    return;
                }

                event.preventDefault();
                onOpenPreview();
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
        </Link>
    );
}
