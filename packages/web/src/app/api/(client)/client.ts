'use client';

import { fileSourceResponseSchema, getVersionResponseSchema, listRepositoriesResponseSchema, searchResponseSchema } from "@/lib/schemas";
import { ServiceError } from "@/lib/serviceError";
import { FileSourceRequest, FileSourceResponse, GetVersionResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "@/lib/types";
import { isServiceError } from "@/lib/utils";

export const search = async (body: SearchRequest, domain: string): Promise<SearchResponse | ServiceError> => {
    const result = await fetch("/api/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return searchResponseSchema.parse(result);
}

export const fetchFileSource = async (body: FileSourceRequest, domain: string): Promise<FileSourceResponse> => {
    const result = await fetch("/api/source", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    return fileSourceResponseSchema.parse(result);
}

export const getRepos = async (domain: string): Promise<ListRepositoriesResponse> => {
    const result = await fetch("/api/repos", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
    }).then(response => response.json());

    return listRepositoriesResponseSchema.parse(result);
}

export const getVersion = async (): Promise<GetVersionResponse> => {
    const result = await fetch("/api/version", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());
    return getVersionResponseSchema.parse(result);
}
