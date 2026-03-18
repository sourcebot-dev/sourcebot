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
    repo: z.string().describe("The repository to scope the search to").optional(),
};

export type FindSymbolFile = {
    fileName: string;
    repo: string;
    language: string;
    matches: string[];
    revision: string;
};

export type FindSymbolReferencesMetadata = {
    files: FindSymbolFile[];
};

export const findSymbolReferencesDefinition: ToolDefinition<
    'find_symbol_references',
    typeof findSymbolReferencesShape,
    FindSymbolReferencesMetadata
> = {
    name: 'find_symbol_references',
    description,
    inputSchema: z.object(findSymbolReferencesShape),
    execute: async ({ symbol, language, repo }) => {
        logger.debug('findSymbolReferences', { symbol, language, repo });
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repo,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: FindSymbolReferencesMetadata = {
            files: response.files.map((file) => ({
                fileName: file.fileName,
                repo: file.repository,
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
