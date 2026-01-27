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
