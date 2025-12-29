import { z } from "zod";
import { getReposResponseSchema, getVersionResponseSchema, repositoryQuerySchema, searchContextQuerySchema } from "./schemas";
import { tenancyModeSchema } from "@sourcebot/shared";

export type KeymapType = "default" | "vim";

export type GetVersionResponse = z.infer<typeof getVersionResponseSchema>;

export enum SearchQueryParams {
    query = "query",
    matches = "matches",
    isRegexEnabled = "isRegexEnabled",
    isCaseSensitivityEnabled = "isCaseSensitivityEnabled",
    isArchivedExcluded = "isArchivedExcluded",
    isForkedExcluded = "isForkedExcluded",
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
export type GetReposResponse = z.infer<typeof getReposResponseSchema>;