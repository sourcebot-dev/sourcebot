import { SHARD_MAX_MATCH_COUNT, TOTAL_MAX_MATCH_COUNT } from "../environment";
import { FileSourceRequest, FileSourceResponse, SearchRequest, SearchResponse, searchResponseSchema } from "../schemas";
import { fileNotFound, invalidZoektResponse, ServiceError } from "../serviceError";
import { isServiceError } from "../utils";
import { zoektFetch } from "./zoektClient";

export const search = async ({ query, numResults, whole }: SearchRequest): Promise<SearchResponse | ServiceError> => {
    const body = JSON.stringify({
        q: query,
        // @see: https://github.com/TaqlaAI/zoekt/blob/main/api.go#L892
        opts: {
            NumContextLines: 2,
            ChunkMatches: true,
            MaxMatchDisplayCount: numResults,
            Whole: !!whole,
            ShardMaxMatchCount: SHARD_MAX_MATCH_COUNT,
            TotalMaxMatchCount: TOTAL_MAX_MATCH_COUNT,
        }
    });

    const searchResponse = await zoektFetch({
        path: "/api/search",
        body,
        method: "POST",
    });

    if (!searchResponse.ok) {
        return invalidZoektResponse(searchResponse);
    }

    const searchBody = await searchResponse.json();
    return searchResponseSchema.parse(searchBody);
}

export const getFileSource = async ({ fileName, repository }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const searchResponse = await search({
        query: `${fileName} repo:${repository}`,
        numResults: 1,
        whole: true,
    });

    if (isServiceError(searchResponse)) {
        return searchResponse;
    }

    const files = searchResponse.Result.Files;

    if (files.length === 0) {
        return fileNotFound(fileName, repository);
    }

    const source = files[0].Content ?? '';
    return {
        source
    }
}