import { z } from "zod";
import { InferToolInput, InferToolOutput, InferUITool, tool, ToolUIPart } from "ai";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolReferences } from "../../codeNav/api";
import { addLineNumbers } from "../utils";
import { toolNames } from "../constants";
import { logger } from "../logger";
import description from './findSymbolReferences.txt';

export const findSymbolReferencesTool = tool({
    description,
    inputSchema: z.object({
        symbol: z.string().describe("The symbol to find references to"),
        language: z.string().describe("The programming language of the symbol"),
        repository: z.string().describe("The repository to scope the search to").optional(),
    }),
    execute: async ({ symbol, language, repository }) => {
        logger.debug('findSymbolReferences', { symbol, language, repository });
        // @todo: make revision configurable.
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            language,
            revisionName: "HEAD",
            repoName: repository,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
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
    },
});

export type FindSymbolReferencesTool = InferUITool<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolInput = InferToolInput<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolOutput = InferToolOutput<typeof findSymbolReferencesTool>;
export type FindSymbolReferencesToolUIPart = ToolUIPart<{ [toolNames.findSymbolReferences]: FindSymbolReferencesTool }>
