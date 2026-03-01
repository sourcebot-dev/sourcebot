import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolDefinitions } from "../../codeNav/api";
import { addLineNumbers } from "../utils";
import { toolNames } from "../constants";
import { logger } from "../logger";
import description from './findSymbolDefinitions.txt';

export const findSymbolDefinitionsTool = tool({
    description,
    inputSchema: z.object({
        symbol: z.string().describe("The symbol to find definitions of"),
        language: z.string().describe("The programming language of the symbol"),
        repository: z.string().describe("The repository to scope the search to").optional(),
    }),
    execute: async ({ symbol, language, repository }) => {
        logger.debug('findSymbolDefinitions', { symbol, language, repository });
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolDefinitions({
            symbolName: symbol,
            language,
            revisionName: revision,
            repoName: repository,
        });

        if (isServiceError(response)) {
            return response;
        }

        return response.files.map((file) => ({
            fileName: file.fileName,
            repository: file.repository,
            language: file.language,
            matches: file.matches.map(({ lineContent, range }) => {
                return addLineNumbers(lineContent, range.start.lineNumber);
            }),
            revision,
        }));
    }
});

export type FindSymbolDefinitionsTool = InferUITool<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolInput = InferToolInput<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolOutput = InferToolOutput<typeof findSymbolDefinitionsTool>;
export type FindSymbolDefinitionsToolUIPart = ToolUIPart<{ [toolNames.findSymbolDefinitions]: FindSymbolDefinitionsTool }>
