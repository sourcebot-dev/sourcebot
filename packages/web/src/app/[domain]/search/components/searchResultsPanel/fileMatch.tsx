'use client';

import { useMemo } from "react";
import { CodePreview } from "./codePreview";
import { SearchResultFile, SearchResultChunk } from "@/lib/types";
import { base64Decode } from "@/lib/utils";


interface FileMatchProps {
    match: SearchResultChunk;
    file: SearchResultFile;
    onOpen: () => void;
}

export const FileMatch = ({
    match,
    file,
    onOpen,
}: FileMatchProps) => {
    const content = useMemo(() => {
        return base64Decode(match.content);
    }, [match.content]);

    // If it's just the title, don't show a code preview
    if (match.matchRanges.length === 0) {
        return null;
    }

    return (
        <div
            tabIndex={0}
            className="cursor-pointer focus:ring-inset focus:ring-4 bg-white dark:bg-[#282c34]"
            onKeyDown={(e) => {
                if (e.key !== "Enter") {
                    return;
                }
                onOpen();
            }}
            onClick={onOpen}
        >
            <CodePreview
                content={content}
                language={file.language}
                ranges={match.matchRanges}
                lineOffset={match.contentStart.lineNumber - 1}
            />
        </div>
    );
}