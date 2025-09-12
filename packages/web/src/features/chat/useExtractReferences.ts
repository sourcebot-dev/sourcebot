'use client';

import { useMemo } from "react";
import { FileReference } from "./types";
import { FILE_REFERENCE_REGEX } from "./constants";
import { createFileReference } from "./utils";
import { TextUIPart } from "ai";

export const useExtractReferences = (part?: TextUIPart) => {
    return useMemo(() => {
        if (!part) {
            return [];
        }

        const references: FileReference[] = [];

        const content = part.text;
        FILE_REFERENCE_REGEX.lastIndex = 0;

        let match;
        while ((match = FILE_REFERENCE_REGEX.exec(content ?? '')) !== null && match !== null) {
            const [_, repo, fileName, startLine, endLine] = match;

            const fileReference = createFileReference({
                repo: repo,
                path: fileName,
                startLine,
                endLine,
            });

            references.push(fileReference);
        }

        return references;
    }, [part]);
};
