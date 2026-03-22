import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolDefinitions } from "@/features/codeNav/api";
import { addLineNumbers } from "@/features/chat/utils";
import { ToolDefinition } from "./types";
import { FindSymbolFile } from "./findSymbolReferences";
import { logger } from "./logger";
import description from "./findSymbolDefinitions.txt";
import { detectLanguageFromFilename } from "@/lib/languageDetection";

const findSymbolDefinitionsShape = {
    symbol: z.string().describe("The symbol to find definitions of"),
    path: z.string().describe("The file path where the symbol was encountered."),
    repo: z.string().describe("The repository to scope the search to"),
};

export type FindSymbolDefinitionsMetadata = {
    files: FindSymbolFile[];
};

export const findSymbolDefinitionsDefinition: ToolDefinition<
    'find_symbol_definitions',
    typeof findSymbolDefinitionsShape,
    FindSymbolDefinitionsMetadata
> = {
    name: 'find_symbol_definitions',
    title: 'Find symbol definitions',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(findSymbolDefinitionsShape),
    execute: async ({ symbol, path, repo }, _context) => {
        logger.debug('find_symbol_definitions', { symbol, path, repo });
        const revision = "HEAD";
        const language = detectLanguageFromFilename(path);

        const response = await findSearchBasedSymbolDefinitions({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repo,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: FindSymbolDefinitionsMetadata = {
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
