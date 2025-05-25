import { z } from "zod";
import { getVersionResponseSchema, repositoryQuerySchema } from "./schemas";
import { tenancyModeSchema } from "@/env.mjs";

export type KeymapType = "default" | "vim";

export type GetVersionResponse = z.infer<typeof getVersionResponseSchema>;

export enum SearchQueryParams {
    query = "query",
    matches = "matches",
}

export type ApiKeyPayload = {
    apiKey: string;
    domain: string;
};

export type TenancyMode = z.infer<typeof tenancyModeSchema>;
export type RepositoryQuery = z.infer<typeof repositoryQuerySchema>;