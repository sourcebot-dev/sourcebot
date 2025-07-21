'use client';

import { useMemo } from "react";
import { SBChatMessage, FileReference } from "./types";
import { FILE_REFERENCE_REGEX } from "./constants";
import { createFileReference } from "./utils";

export const useExtractReferences = (message?: SBChatMessage) => {
    return useMemo(() => {
        const references: FileReference[] = [];

        message?.parts.forEach((part) => {
            switch (part.type) {
                case 'text':
                case 'reasoning': {
                    const content = part.text;
                    FILE_REFERENCE_REGEX.lastIndex = 0;

                    let match;
                    while ((match = FILE_REFERENCE_REGEX.exec(content ?? '')) !== null && match !== null) {
                        const [_, fileName, startLine, endLine] = match;

                        const fileReference = createFileReference({
                            fileName,
                            startLine,
                            endLine,
                        });

                        references.push(fileReference);
                    }
                    break;
                }
            }
        });

        return references;
    }, [message]);
};
