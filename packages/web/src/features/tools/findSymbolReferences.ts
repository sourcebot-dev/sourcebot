import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/api";
import { addLineNumbers } from "@/features/chat/utils";
import { createLogger } from "@sourcebot/shared";
import { ToolDefinition } from "./types";
import description from "./findSymbolReferences.txt";

const logger = createLogger('tool-findSymbolReferences');

const findSymbolReferencesShape = {
    symbol: z.string().describe("The symbol to find references to"),
    language: z.string().describe("The programming language of the symbol"),
    repository: z.string().describe("The repository to scope the search to").optional(),
};

export type FindSymbolFile = {
    fileName: string;
    repository: string;
    language: string;
    matches: string[];
    revision: string;
};

export type FindSymbolReferencesMetadata = {
    files: FindSymbolFile[];
};

export const findSymbolReferencesDefinition: ToolDefinition<
    'findSymbolReferences',
    typeof findSymbolReferencesShape,
    FindSymbolReferencesMetadata
> = {
    name: 'findSymbolReferences',
    description,
    inputSchema: z.object(findSymbolReferencesShape),
    execute: async ({ symbol, language, repository }) => {
        logger.debug('findSymbolReferences', { symbol, language, repository });
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repository,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: FindSymbolReferencesMetadata = {
            files: response.files.map((file) => ({
                fileName: file.fileName,
                repository: file.repository,
                language: file.language,
                matches: file.matches.map(({ lineContent, range }) => {
                    return addLineNumbers(lineContent, range.start.lineNumber);
                }),
                revision,
            })),
        };

        return {
            output: JSON.stringify(metadata),
            metadata,
        };
    },
};
