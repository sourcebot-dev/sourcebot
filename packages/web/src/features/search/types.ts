// @NOTE : Please keep this file in sync with @sourcebot/mcp/src/types.ts
import {
    fileSourceResponseSchema,
    locationSchema,
    searchRequestSchema,
    searchResponseSchema,
    rangeSchema,
    fileSourceRequestSchema,
    symbolSchema,
    repositoryInfoSchema,
} from "./schemas";
import { z } from "zod";

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SearchResultLocation = z.infer<typeof locationSchema>;
export type SearchResultFile = SearchResponse["files"][number];
export type SearchResultChunk = SearchResultFile["chunks"][number];
export type SearchSymbol = z.infer<typeof symbolSchema>;

export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

export type RepositoryInfo = z.infer<typeof repositoryInfoSchema>;
export type SourceRange = z.infer<typeof rangeSchema>;