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
import type { PermissionSyncStatusResponse } from "../(server)/ee/permissionSyncStatus/api";
import type { AccountSyncStatusResponse } from "../(server)/ee/accountPermissionSyncJobStatus/api";
import type {
    SearchChatShareableMembersQueryParams,
    SearchChatShareableMembersResponse,
} from "../(server)/ee/chat/[chatId]/searchMembers/route";
import { ConnectMcpResponse } from "../(server)/ee/askmcp/connect/types";
import type { GetMcpServersResponse } from "../(server)/ee/askmcp/servers/route";

export const search = async (body: SearchRequest): Promise<SearchResponse | ServiceError> => {
    const result = await fetch("/api/search", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
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
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        }
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
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
    }).then(response => response.json());

    return result as ListReposResponse | ServiceError;
}

export const getVersion = async (): Promise<GetVersionResponse> => {
    const result = await fetch("/api/version", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
    }).then(response => response.json());
    return result as GetVersionResponse;
}

export const findSearchBasedSymbolReferences = async (body: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => {
    const result = await fetch("/api/find_references", {
        method: "POST",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as FindRelatedSymbolsResponse | ServiceError;
}

export const findSearchBasedSymbolDefinitions = async (body: FindRelatedSymbolsRequest): Promise<FindRelatedSymbolsResponse | ServiceError> => {
    const result = await fetch("/api/find_definitions", {
        method: "POST",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as FindRelatedSymbolsResponse | ServiceError;
}

export const getTree = async (body: GetTreeRequest): Promise<GetTreeResponse | ServiceError> => {
    const result = await fetch("/api/tree", {
        method: "POST",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as GetTreeResponse | ServiceError;
}

export const getFiles = async (body: GetFilesRequest): Promise<GetFilesResponse | ServiceError> => {
    const result = await fetch("/api/files", {
        method: "POST",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        body: JSON.stringify(body),
    }).then(response => response.json());
    return result as GetFilesResponse | ServiceError;
}

export const getPermissionSyncStatus = async (): Promise<PermissionSyncStatusResponse | ServiceError> => {
    const result = await fetch("/api/ee/permissionSyncStatus", {
        method: "GET",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
    }).then(response => response.json());
    return result as PermissionSyncStatusResponse | ServiceError;
}

export const getAccountSyncStatus = async (jobId: string): Promise<AccountSyncStatusResponse | ServiceError> => {
    const url = new URL("/api/ee/accountPermissionSyncJobStatus", window.location.origin);
    url.searchParams.set("jobId", jobId);
    const result = await fetch(url, {
        headers: { "X-Sourcebot-Client-Source": "sourcebot-web-client" },
    }).then(r => r.json());
    return result as AccountSyncStatusResponse | ServiceError;
}

export const searchChatShareableMembers = async (
    params: SearchChatShareableMembersQueryParams & { chatId: string },
    signal?: AbortSignal
): Promise<SearchChatShareableMembersResponse | ServiceError> => {
    const url = new URL(`/api/ee/chat/${params.chatId}/searchMembers`, window.location.origin);
    if (params.query) {
        url.searchParams.set('query', params.query);
    }

    const result = await fetch(url, {
        method: "GET",
        headers: {
            "X-Sourcebot-Client-Source": "sourcebot-web-client",
        },
        signal,
    }).then(response => response.json());

    return result as SearchChatShareableMembersResponse | ServiceError;
}

export const connectMcpToAsk = async (body: { serverId: string }): Promise<ConnectMcpResponse | ServiceError> => {
    const result = await fetch('/api/ee/askmcp/connect', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'sourcebot-web-client',
        },
        body: JSON.stringify(body),
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return result as ConnectMcpResponse;
}

export const getMcpServersWithStatus = async (): Promise<GetMcpServersResponse | ServiceError> => {
    const result = await fetch('/api/ee/askmcp/servers', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'sourcebot-web-client',
        },
    }).then(response => response.json());

    return result as GetMcpServersResponse | ServiceError;
}
