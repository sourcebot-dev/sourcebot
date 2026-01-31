'use client';

import { ServiceError } from "@/lib/serviceError";
import { GetVersionResponse, ListReposQueryParams, ListReposResponse } from "@/lib/types";
import { isServiceError } from "@/lib/utils";
import {
    SearchRequest,
    SearchResponse,
} from "@/features/search";
import {
    FindRelatedSymbolsRequest,
    FindRelatedSymbolsResponse,
} from "@/features/codeNav/types";
import {
    GetFilesRequest,
    GetFilesResponse,
    GetTreeRequest,
    GetTreeResponse,
    FileSourceRequest,
    FileSourceResponse,
} from "@/features/git";

export const search = async (body: SearchRequest): Promise<SearchResponse | ServiceError> => {
    const result = await fetch("/api/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return result as SearchResponse | ServiceError;
}

export const getFileSource = async (queryParams: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const url = new URL("/api/source", window.location.origin);
    for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value.toString());
    }

    const result = await fetch(url, {
        method: "GET",
    }).then(response => response.json());

    return result as FileSourceResponse | ServiceError;
}

export const listRepos = async (queryParams: ListReposQueryParams): Promise<ListReposResponse | ServiceError> => {
    const url = new URL("/api/repos", window.location.origin);
    for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value.toString());
    }

    const result = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());

    return result as ListReposResponse | ServiceError;
}

export const getVersion = async (): Promise<GetVersionResponse> => {
    const result = await fetch("/api/version", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());
    return result as GetVersionResponse;
}

export const findSearchBasedSymbolReferences = async (body: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => {
    const result = await fetch("/api/find_references", {
        method: "POST",
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as FindRelatedSymbolsResponse | ServiceError;
}

export const findSearchBasedSymbolDefinitions = async (body: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => {
    const result = await fetch("/api/find_definitions", {
        method: "POST",
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as FindRelatedSymbolsResponse | ServiceError;
}

export const getTree = async (body: GetTreeRequest): Promise<GetTreeResponse | ServiceError> => {
    const result = await fetch("/api/tree", {
        method: "POST",
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as GetTreeResponse | ServiceError;
}

export const getFiles = async (body: GetFilesRequest): Promise<GetFilesResponse | ServiceError> => {
    const result = await fetch("/api/files", {
        method: "POST",
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as GetFilesResponse | ServiceError;
}
