'use client';

import { useMemo } from "react";
import { SBChatMessage, FileReference } from "./types";
import { FILE_REFERENCE_REGEX } from "./constants";
import { getFileReferenceId } from "./utils";

export const useExtractReferences = (message: SBChatMessage) => {
    return useMemo(() => {
        const references: FileReference[] = [];

        message.parts.forEach((part) => {
            switch (part.type) {
                case 'text':
                case 'reasoning':
                case 'tool-answerTool': {
                    const content = part.type === 'tool-answerTool' ? part.input?.answer : part.text;
                    FILE_REFERENCE_REGEX.lastIndex = 0;

                    let match;
                    while ((match = FILE_REFERENCE_REGEX.exec(content ?? '')) !== null && match !== null) {
                        const [_, fileName, startLine, endLine] = match;

                        references.push({
                            type: 'file',
                            id: getFileReferenceId(fileName, startLine && endLine ? {
                                startLine: parseInt(startLine),
                                endLine: parseInt(endLine),
                            } : undefined),
                            fileName,
                            ...(startLine && endLine ? {
                                range: {
                                    startLine: parseInt(startLine),
                                    endLine: parseInt(endLine),
                                }
                            } : {}),
                        });
                    }
                    break;
                }
            }
        });

        return references;
    }, [message]);
};
