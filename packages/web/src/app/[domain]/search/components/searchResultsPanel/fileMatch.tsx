'use client';

import { SearchResultFile, SearchResultChunk } from "@/features/search/types";
import { LightweightCodeHighlighter } from "@/app/[domain]/components/lightweightCodeHighlighter";
import Link from "next/link";
import { getBrowsePath } from "@/app/[domain]/browse/hooks/utils";
import { useDomain } from "@/hooks/useDomain";


interface FileMatchProps {
    match: SearchResultChunk;
    file: SearchResultFile;
}

export const FileMatch = ({
    match,
    file,
}: FileMatchProps) => {
    const domain = useDomain();

    // If it's just the title, don't show a code preview
    if (match.matchRanges.length === 0) {
        return null;
    }

    return (
        <Link
            tabIndex={0}
            className="cursor-pointer focus:ring-inset focus:ring-4 bg-background hover:bg-editor-lineHighlight"
            href={getBrowsePath({
                repoName: file.repository,
                revisionName: file.branches?.[0] ?? 'HEAD',
                path: file.fileName.text,
                pathType: 'blob',
                domain,
                highlightRange: {
                    start: {
                        lineNumber: match.contentStart.lineNumber,
                    },
                    end: {
                        lineNumber: match.content.trimEnd().split('\n').length + match.contentStart.lineNumber - 1,
                    }
                }
            })}
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