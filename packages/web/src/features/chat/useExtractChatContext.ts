'use client';

import { useMemo } from "react";
import { ChatContext, SBChatMessage } from "./types";
import { isServiceError } from "@/lib/utils";

export const useExtractChatContext = (messages: SBChatMessage[]): ChatContext => {
    return useMemo(() => {
        const extractedFiles: {
            path: string;
            repository: string;
            language: string;
            revision: string;
        }[] = [];

        messages
            .forEach(message => {
                message.metadata?.mentions?.forEach((mention) => {
                    if (mention.type === 'file') {
                        extractedFiles.push({
                            path: mention.path,
                            repository: mention.repo,
                            language: mention.language,
                            revision: mention.revision,
                        });
                    }
                })

                message.parts.forEach((part) => {
                    if (
                        part.type === 'tool-readFiles' &&
                        part.state === 'output-available' &&
                        !isServiceError(part.output)
                    ) {
                        const files = part.output;
                        files.forEach((file) => {
                            extractedFiles.push({
                                path: file.path,
                                repository: file.repository,
                                language: file.language,
                                revision: file.revision,
                            });
                        });
                    }
                    
                    if (
                        part.type === 'tool-searchCode' &&
                        part.state === 'output-available' &&
                        !isServiceError(part.output)
                    ) {
                        part.output.files.forEach((file) => {
                            extractedFiles.push({
                                path: file.fileName,
                                repository: file.repository,
                                language: file.language,
                                revision: file.revision,
                            });
                        });
                    }

                    if (
                        part.type === 'tool-findSymbolDefinitions' &&
                        part.state === 'output-available' &&
                        !isServiceError(part.output)
                    ) {
                        part.output.forEach((file) => {
                            extractedFiles.push({
                                path: file.fileName,
                                repository: file.repository,
                                language: file.language,
                                revision: file.revision,
                            });
                        });
                    }

                    if (
                        part.type === 'tool-findSymbolReferences' &&
                        part.state === 'output-available' &&
                        !isServiceError(part.output)
                    ) {
                        part.output.forEach((file) => {
                            extractedFiles.push({
                                path: file.fileName,
                                repository: file.repository,
                                language: file.language,
                                revision: file.revision,
                            });
                        });
                    }
                });

            });

        return {
            files: extractedFiles,
        };
    }, [messages]);
};
