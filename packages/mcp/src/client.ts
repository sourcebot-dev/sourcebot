import { env } from './env.js';
import { listReposResponseSchema, searchResponseSchema, fileSourceResponseSchema, listCommitsResponseSchema, askCodebaseResponseSchema, listLanguageModelsResponseSchema, listTreeApiResponseSchema } from './schemas.js';
import { AskCodebaseRequest, AskCodebaseResponse, FileSourceRequest, ListReposQueryParams, SearchRequest, ListCommitsQueryParamsSchema, ListLanguageModelsResponse, ListTreeApiRequest, ListTreeApiResponse } from './types.js';
import { isServiceError, ServiceErrorException } from './utils.js';
import { z } from 'zod';

const parseResponse = async <T extends z.ZodTypeAny>(
    response: Response,
    schema: T
): Promise<z.infer<T>> => {
    const text = await response.text();

    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON response: ${text}`);
    }

    // Check if the response is already a service error from the API
    if (isServiceError(json)) {
        throw new ServiceErrorException(json);
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        throw new Error(`Failed to parse response: ${parsed.error.message}`);
    }

    return parsed.data;
};

export const search = async (request: SearchRequest) => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    });

    return parseResponse(response, searchResponseSchema);
}

export const listRepos = async (queryParams: ListReposQueryParams = {}) => {
    const url = new URL(`${env.SOURCEBOT_HOST}/api/repos`);

    for (const [key, value] of Object.entries(queryParams)) {
        if (value) {
            url.searchParams.set(key, value.toString());
        }
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    });

    const repos = await parseResponse(response, listReposResponseSchema);
    const totalCount = parseInt(response.headers.get('X-Total-Count') ?? '0', 10);
    return { repos, totalCount };
}

export const getFileSource = async (request: FileSourceRequest) => {
    const url = new URL(`${env.SOURCEBOT_HOST}/api/source`);
    for (const [key, value] of Object.entries(request)) {
        if (value) {
            url.searchParams.set(key, value.toString());
        }
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    });

    return parseResponse(response, fileSourceResponseSchema);
}

export const listCommits = async (queryParams: ListCommitsQueryParamsSchema) => {
    const url = new URL(`${env.SOURCEBOT_HOST}/api/commits`);
    for (const [key, value] of Object.entries(queryParams)) {
        if (value) {
            url.searchParams.set(key, value.toString());
        }
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Org-Domain': '~',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    });

    const commits = await parseResponse(response, listCommitsResponseSchema);
    const totalCount = parseInt(response.headers.get('X-Total-Count') ?? '0', 10);
    return { commits, totalCount };
}

/**
 * Fetches a repository tree (or subtree union) from the Sourcebot tree API.
 *
 * @param request - Repository name, revision, and path selectors for the tree query
 * @returns A tree response rooted at `tree` containing nested `tree`/`blob` nodes
 */
export const listTree = async (request: ListTreeApiRequest): Promise<ListTreeApiResponse> => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/tree`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request),
    });

    return parseResponse(response, listTreeApiResponseSchema);
}

/**
 * Asks a natural language question about the codebase using the Sourcebot AI agent.
 * This is a blocking call that runs the full agent loop and returns when complete.
 *
 * @param request - The question and optional repo filters
 * @returns The agent's answer, chat URL, sources, and metadata
 */
export const askCodebase = async (request: AskCodebaseRequest): Promise<AskCodebaseResponse> => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/chat/blocking`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request),
    });

    return parseResponse(response, askCodebaseResponseSchema);
}

/**
 * Lists the available language models configured on the Sourcebot instance.
 *
 * @returns Array of language model info objects
 */
export const listLanguageModels = async (): Promise<ListLanguageModelsResponse> => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/models`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-Sourcebot-Client-Source': 'mcp',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    });

    return parseResponse(response, listLanguageModelsResponseSchema);
}
