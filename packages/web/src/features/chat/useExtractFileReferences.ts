'use client';

import { useMemo } from "react";
import { SBChatMessage, FileReference } from "./types";
import { FILE_REFERENCE_REGEX } from "./constants";

export const useExtractFileReferences = (messages: SBChatMessage[]) => {
    return useMemo(() => {
        const references: FileReference[] = [];
        
        messages
            .forEach(message => {
                message.parts.forEach((part) => {
                    switch (part.type) {
                        case 'text':
                        case 'reasoning':
                        case 'tool-answerTool': {
                            const content = part.type === 'tool-answerTool' ? part.input?.answer : part.text;
                            FILE_REFERENCE_REGEX.lastIndex = 0;
                        
                            let match;
                            while ((match = FILE_REFERENCE_REGEX.exec(content ?? '')) !== null) {
                                const [_, fileName, startLine, endLine] = match;
                                
                                references.push({
                                    fileName,
                                    startLine: startLine ? parseInt(startLine) : undefined,
                                    endLine: endLine ? parseInt(endLine) : undefined,
                                });
                            }
                            break;
                        }
                    }
                });
            });
        
        return references;
    }, [messages]);
};
