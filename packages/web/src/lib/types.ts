import { z } from "zod";
import {
    getRefsRequestSchema, getRefsResponseSchema, getVersionResponseSchema, listReposQueryParamsSchema, listReposResponseSchema, repositoryQuerySchema, searchContextQuerySchema } from "./schemas";
import { tenancyModeSchema } from "@sourcebot/shared";

export type KeymapType = "default" | "vim";

export type GetVersionResponse = z.infer<typeof getVersionResponseSchema>;

export enum SearchQueryParams {
    query = "query",
    matches = "matches",
    isRegexEnabled = "isRegexEnabled",
    isCaseSensitivityEnabled = "isCaseSensitivityEnabled",
}

export type ApiKeyPayload = {
    apiKey: string;
    domain: string;
};

export type NewsItem = {
    unique_id: string;
    header: string;
    sub_header: string;
    url: string;
    read?: boolean;
}

export type TenancyMode = z.infer<typeof tenancyModeSchema>;
export type RepositoryQuery = z.infer<typeof repositoryQuerySchema>;
export type SearchContextQuery = z.infer<typeof searchContextQuerySchema>;
export type ListReposResponse = z.infer<typeof listReposResponseSchema>;
export type ListReposQueryParams = z.infer<typeof listReposQueryParamsSchema>;
export type GetRefsRequest = z.infer<typeof getRefsRequestSchema>;
export type GetRefsResponse = z.infer<typeof getRefsResponseSchema>;