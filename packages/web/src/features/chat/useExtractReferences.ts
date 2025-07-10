'use client';

import { useMemo } from "react";
import { SBChatMessage, FileReference } from "./types";
import { FILE_REFERENCE_REGEX } from "./constants";

export const useExtractReferences = (messages: SBChatMessage[]) => {
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
                            while ((match = FILE_REFERENCE_REGEX.exec(content ?? '')) !== null && match !== null) {
                                const [_, fileName, startLine, endLine] = match;
                                
                                references.push({
                                    type: 'file',
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
            });
        
        return references;
    }, [messages]);
};
