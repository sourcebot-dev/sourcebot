import { env } from './env.js';
import { listRepositoriesResponseSchema, searchResponseSchema, fileSourceResponseSchema, listCommitsResponseSchema } from './schemas.js';
import { FileSourceRequest, ListReposRequest, SearchRequest, ListCommitsRequestSchema } from './types.js';
import { isServiceError, ServiceErrorException } from './utils.js';
import { z } from 'zod';

export interface ListReposResult {
    repos: z.infer<typeof listRepositoriesResponseSchema>;
    totalCount: number;
}

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
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    });

    return parseResponse(response, searchResponseSchema);
}

export const listRepos = async (request: ListReposRequest = {}) => {
    const url = new URL(`${env.SOURCEBOT_HOST}/api/repos`);

    for (const [key, value] of Object.entries(request)) {
        if (value) {
            url.searchParams.set(key, value.toString());
        }
    }

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    });

    const repos = await parseResponse(response, listRepositoriesResponseSchema);
    const totalCount = parseInt(response.headers.get('X-Total-Count') ?? '0', 10);
    return { repos, totalCount };
}

export const getFileSource = async (request: FileSourceRequest) => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/source`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    });

    return parseResponse(response, fileSourceResponseSchema);
}

export const listCommits = async (request: ListCommitsRequestSchema) => {
    const response = await fetch(`${env.SOURCEBOT_HOST}/api/commits`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    });

    return parseResponse(response, listCommitsResponseSchema);
}
