'use client';

import { NEXT_PUBLIC_BASE_PATH } from "@/lib/environment.client";
import { fileSourceResponseSchema, listRepositoriesResponseSchema, searchResponseSchema } from "@/lib/schemas";
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "@/lib/types";

export const search = async (body: SearchRequest): Promise<SearchResponse> => {
    const result = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    return searchResponseSchema.parse(result);
}

export const fetchFileSource = async (body: FileSourceRequest): Promise<FileSourceResponse> => {
    const result = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/source`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    return fileSourceResponseSchema.parse(result);
}

export const getRepos = async (): Promise<ListRepositoriesResponse> => {
    const result = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/repos`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());

    return listRepositoriesResponseSchema.parse(result);
}
