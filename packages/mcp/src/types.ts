// @NOTE : Please keep this file in sync with @sourcebot/web/src/features/search/types.ts
// At some point, we should move these to a shared package...
import {
    fileSourceResponseSchema,
    listReposQueryParamsSchema,
    locationSchema,
    searchRequestSchema,
    searchResponseSchema,
    rangeSchema,
    fileSourceRequestSchema,
    symbolSchema,
    serviceErrorSchema,
    listCommitsQueryParamsSchema,
    listCommitsResponseSchema,
    askCodebaseRequestSchema,
    askCodebaseResponseSchema,
    languageModelInfoSchema,
    listLanguageModelsResponseSchema,
    listTreeApiRequestSchema,
    listTreeApiResponseSchema,
    listTreeRequestSchema,
    listTreeEntrySchema,
    listTreeResponseSchema,
} from "./schemas.js";
import { z } from "zod";

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type SearchResultRange = z.infer<typeof rangeSchema>;
export type SearchResultLocation = z.infer<typeof locationSchema>;
export type SearchResultFile = SearchResponse["files"][number];
export type SearchResultChunk = SearchResultFile["chunks"][number];
export type SearchSymbol = z.infer<typeof symbolSchema>;

export type ListReposQueryParams = z.input<typeof listReposQueryParamsSchema>;

export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

export type TextContent = { type: "text", text: string };

export type ServiceError = z.infer<typeof serviceErrorSchema>;

export type ListCommitsQueryParamsSchema = z.infer<typeof listCommitsQueryParamsSchema>;
export type ListCommitsResponse = z.infer<typeof listCommitsResponseSchema>;

export type AskCodebaseRequest = z.infer<typeof askCodebaseRequestSchema>;
export type AskCodebaseResponse = z.infer<typeof askCodebaseResponseSchema>;

export type LanguageModelInfo = z.infer<typeof languageModelInfoSchema>;
export type ListLanguageModelsResponse = z.infer<typeof listLanguageModelsResponseSchema>;

export type ListTreeApiRequest = z.infer<typeof listTreeApiRequestSchema>;
export type ListTreeApiResponse = z.infer<typeof listTreeApiResponseSchema>;
export type ListTreeApiNode = ListTreeApiResponse["tree"];

export type ListTreeRequest = z.input<typeof listTreeRequestSchema>;
export type ListTreeEntry = z.infer<typeof listTreeEntrySchema>;
export type ListTreeResponse = z.infer<typeof listTreeResponseSchema>;
