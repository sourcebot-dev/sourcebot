import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolDefinitions } from "@/features/codeNav/api";
import { addLineNumbers } from "@/features/chat/utils";
import { createLogger } from "@sourcebot/shared";
import { ToolDefinition } from "./types";
import { FindSymbolFile } from "./findSymbolReferences";
import description from "./findSymbolDefinitions.txt";

const logger = createLogger('tool-findSymbolDefinitions');

const findSymbolDefinitionsShape = {
    symbol: z.string().describe("The symbol to find definitions of"),
    language: z.string().describe("The programming language of the symbol"),
    repository: z.string().describe("The repository to scope the search to").optional(),
};

export type FindSymbolDefinitionsMetadata = {
    files: FindSymbolFile[];
};

export const findSymbolDefinitionsDefinition: ToolDefinition<
    'findSymbolDefinitions',
    typeof findSymbolDefinitionsShape,
    FindSymbolDefinitionsMetadata
> = {
    name: 'findSymbolDefinitions',
    description,
    inputSchema: z.object(findSymbolDefinitionsShape),
    execute: async ({ symbol, language, repository }) => {
        logger.debug('findSymbolDefinitions', { symbol, language, repository });
        const revision = "HEAD";

        const response = await findSearchBasedSymbolDefinitions({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repository,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const metadata: FindSymbolDefinitionsMetadata = {
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
