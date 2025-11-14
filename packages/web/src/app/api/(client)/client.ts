'use client';

import { ServiceError } from "@/lib/serviceError";
import { GetVersionResponse, GetReposResponse } from "@/lib/types";
import { isServiceError } from "@/lib/utils";
import {
    FileSourceResponse,
    FileSourceRequest,
    SearchRequest,
    SearchResponse,
} from "@/features/search/types";
import { FindRelatedSymbolsRequest, FindRelatedSymbolsResponse } from "@/features/codeNav/types";

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

export const fetchFileSource = async (body: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const result = await fetch("/api/source", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    return result as FileSourceResponse | ServiceError;
}

export const getRepos = async (): Promise<GetReposResponse> => {
    const result = await fetch("/api/repos", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    }).then(response => response.json());

    return result as GetReposResponse | ServiceError;
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