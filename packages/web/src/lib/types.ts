import { z } from "zod";
import { fileSourceRequestSchema, fileSourceResponseSchema, listRepositoriesResponseSchema, locationSchema, rangeSchema, repositorySchema, repositoryQuerySchema, searchRequestSchema, searchResponseSchema, symbolSchema } from "./schemas";

export type KeymapType = "default" | "vim";

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export type SearchResult = SearchResponse["Result"];
export type SearchResultFile = NonNullable<SearchResult["Files"]>[number];
export type SearchResultFileMatch = SearchResultFile["ChunkMatches"][number];
export type SearchResultRange = z.infer<typeof rangeSchema>;
export type SearchResultLocation = z.infer<typeof locationSchema>;

export type FileSourceRequest = z.infer<typeof fileSourceRequestSchema>;
export type FileSourceResponse = z.infer<typeof fileSourceResponseSchema>;

export type ListRepositoriesResponse = z.infer<typeof listRepositoriesResponseSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type RepositoryQuery = z.infer<typeof repositoryQuerySchema>;
export type Symbol = z.infer<typeof symbolSchema>;

export enum SearchQueryParams {
    query = "query",
    maxMatchDisplayCount = "maxMatchDisplayCount",
}