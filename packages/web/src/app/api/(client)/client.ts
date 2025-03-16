'use client';

import { NEXT_PUBLIC_DOMAIN_SUB_PATH } from "@/lib/environment.client";
import { fileSourceResponseSchema, getVersionResponseSchema, listRepositoriesResponseSchema, searchResponseSchema } from "@/lib/schemas";
import { FileSourceRequest, FileSourceResponse, GetVersionResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "@/lib/types";
import assert from "assert";

export const search = async (body: SearchRequest, domain: string): Promise<SearchResponse> => {
    const path = resolveServerPath("/api/search");
    const result = await fetch(path, {
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
    const path = resolveServerPath("/api/source");
    const result = await fetch(path, {
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
    const path = resolveServerPath("/api/repos");
    const result = await fetch(path, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
    }).then(response => response.json());

    return listRepositoriesResponseSchema.parse(result);
}

export const getVersion = async (): Promise<GetVersionResponse> => {
    const path = resolveServerPath("/api/version");
    const result = await fetch(path, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());
    return getVersionResponseSchema.parse(result);
}

/**
 * Given a subpath to a api route on the server (e.g., /api/search),
 * returns the full path to that route on the server, taking into account
 * the base path (if any).
 */
export const resolveServerPath = (path: string) => {
    assert(path.startsWith("/"));
    return `${NEXT_PUBLIC_DOMAIN_SUB_PATH}${path}`;
}