'use client';

import { NEXT_PUBLIC_DOMAIN_SUB_PATH } from "@/lib/environment.client";
import { fileSourceResponseSchema, listRepositoriesResponseSchema, searchResponseSchema } from "@/lib/schemas";
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "@/lib/types";
import { measure } from "@/lib/utils";
import assert from "assert";

export const search = async (body: SearchRequest, domain: string): Promise<SearchResponse> => {
    const path = resolveServerPath("/api/search");
    const { data: result } = await measure(() => fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Org-Domain": domain,
        },
        body: JSON.stringify(body),
    }).then(response => response.json()), "client.search");

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

/**
 * Given a subpath to a api route on the server (e.g., /api/search),
 * returns the full path to that route on the server, taking into account
 * the base path (if any).
 */
export const resolveServerPath = (path: string) => {
    assert(path.startsWith("/"));
    return `${NEXT_PUBLIC_DOMAIN_SUB_PATH}${path}`;
}