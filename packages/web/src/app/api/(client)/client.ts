'use client';

import { fileSourceResponseSchema, getVersionResponseSchema, listRepositoriesResponseSchema, searchResponseSchema } from "@/lib/schemas";
import { FileSourceRequest, FileSourceResponse, GetVersionResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "@/lib/types";
import assert from "assert";

export const search = async (body: SearchRequest, domain: string): Promise<SearchResponse> => {
    const result = await fetch("/api/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

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
