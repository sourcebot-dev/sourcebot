import { z } from "zod";
import { isServiceError } from "@/lib/utils";
import { findSearchBasedSymbolReferences } from "@/features/codeNav/api";
import { ToolDefinition } from "./types";
import { logger } from "./logger";
import description from "./findSymbolReferences.txt";
import { getRepoInfoByName } from "@/actions";
import { CodeHostType } from "@sourcebot/db";

const MAX_LINE_LENGTH = 2000;
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`;

const findSymbolReferencesShape = {
    symbol: z.string().describe("The symbol to find references to"),
    repo: z.string().describe("The repository to scope the search to"),
};

export type FindSymbolRepoInfo = {
    name: string;
    displayName: string;
    codeHostType: CodeHostType;
};

export type FindSymbolFile = {
    fileName: string;
    repo: string;
    revision: string;
};

export type FindSymbolReferencesMetadata = {
    symbol: string;
    matchCount: number;
    fileCount: number;
    repoInfo: FindSymbolRepoInfo;
    files: FindSymbolFile[];
};

export const findSymbolReferencesDefinition: ToolDefinition<
    'find_symbol_references',
    typeof findSymbolReferencesShape,
    FindSymbolReferencesMetadata
> = {
    name: 'find_symbol_references',
    title: 'Find symbol references',
    isReadOnly: true,
    isIdempotent: true,
    description,
    inputSchema: z.object(findSymbolReferencesShape),
    execute: async ({ symbol, repo }, _context) => {
        logger.debug('find_symbol_references', { symbol, repo });
        const revision = "HEAD";

        const response = await findSearchBasedSymbolReferences({
            symbolName: symbol,
            revisionName: revision,
            repoName: repo,
        });

        if (isServiceError(response)) {
            throw new Error(response.message);
        }

        const matchCount = response.stats.matchCount;
        const fileCount = response.files.length;

        const repoInfoResult = await getRepoInfoByName(repo);
        if (isServiceError(repoInfoResult) || !repoInfoResult) {
            throw new Error(`Repository "${repo}" not found.`);
        }
        const repoInfo: FindSymbolRepoInfo = {
            name: repoInfoResult.name,
            displayName: repoInfoResult.displayName ?? repoInfoResult.name,
            codeHostType: repoInfoResult.codeHostType,
        };

        const metadata: FindSymbolReferencesMetadata = {
            symbol,
            matchCount,
            fileCount,
            repoInfo,
            files: response.files.map((file) => ({
                fileName: file.fileName,
                repo: file.repository,
                revision,
            })),
        };

        if (fileCount === 0) {
            return {
                output: 'No references found',
                metadata,
            };
        }

        const outputLines: string[] = [
            `Found ${matchCount} ${matchCount === 1 ? 'reference' : 'references'} in ${fileCount} ${fileCount === 1 ? 'file' : 'files'}`,
        ];

        for (const file of response.files) {
            outputLines.push('');
            outputLines.push(`[${file.repository}] ${file.fileName}:`);
            for (const { lineContent, range } of file.matches) {
                const lineNum = range.start.lineNumber;
                const trimmed = lineContent.trimEnd();
                const line = trimmed.length > MAX_LINE_LENGTH
                    ? trimmed.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX
                    : trimmed;
                outputLines.push(`  ${lineNum}: ${line}`);
            }
        }

        return {
            output: outputLines.join('\n'),
            metadata,
        };
    },
};
