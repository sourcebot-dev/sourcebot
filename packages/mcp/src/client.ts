import { env } from './env.js';
import { listRepositoriesResponseSchema, searchResponseSchema, fileSourceResponseSchema, searchCommitsResponseSchema } from './schemas.js';
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, SearchRequest, SearchResponse, ServiceError, SearchCommitsRequest, SearchCommitsResponse } from './types.js';
import { isServiceError } from './utils.js';

export const search = async (request: SearchRequest): Promise<SearchResponse | ServiceError> => {
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return searchResponseSchema.parse(result);
}

export const listRepos = async (): Promise<ListRepositoriesResponse | ServiceError> => {
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/repos`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return listRepositoriesResponseSchema.parse(result);
}

export const getFileSource = async (request: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/source`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return fileSourceResponseSchema.parse(result);
}

export const searchCommits = async (request: SearchCommitsRequest): Promise<SearchCommitsResponse | ServiceError> => {
    const result = await fetch(`${env.SOURCEBOT_HOST}/api/commits`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Org-Domain': '~',
            ...(env.SOURCEBOT_API_KEY ? { 'X-Sourcebot-Api-Key': env.SOURCEBOT_API_KEY } : {})
        },
        body: JSON.stringify(request)
    }).then(response => response.json());

    if (isServiceError(result)) {
        return result;
    }

    return searchCommitsResponseSchema.parse(result);
}
