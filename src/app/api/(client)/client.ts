'use client';

import { FileSourceResponse, fileSourceResponseSchema, SearchRequest, SearchResponse, searchResponseSchema } from "@/lib/schemas";

export const search = async (body: SearchRequest): Promise<SearchResponse> => {
    const result = await fetch(`/api/search`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    return searchResponseSchema.parse(result);
}

export const fetchFileSource = async (fileName: string, repository: string): Promise<FileSourceResponse> => {
    const result = await fetch(`/api/source`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            fileName,
            repository,
        }),
    }).then(response => response.json());

    return fileSourceResponseSchema.parse(result);
}