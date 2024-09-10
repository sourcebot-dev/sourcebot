import { SHARD_MAX_MATCH_COUNT, TOTAL_MAX_MATCH_COUNT } from "../environment";
import { FileSourceRequest, FileSourceResponse, SearchRequest, SearchResponse, searchResponseSchema } from "../schemas";
import { fileNotFound, invalidZoektResponse, schemaValidationError, ServiceError, unexpectedError } from "../serviceError";
import { isServiceError } from "../utils";
import { zoektFetch } from "./zoektClient";
import escapeStringRegexp from "escape-string-regexp";

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
    const parsedSearchResponse = searchResponseSchema.safeParse(searchBody);
    if (!parsedSearchResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedSearchResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return parsedSearchResponse.data;
}

export const getFileSource = async ({ fileName, repository }: FileSourceRequest): Promise<FileSourceResponse | ServiceError> => {
    const escapedFileName = escapeStringRegexp(fileName);
    const escapedRepository = escapeStringRegexp(repository);

    const searchResponse = await search({
        query: `${escapedFileName} repo:^${escapedRepository}$`,
        numResults: 1,
        whole: true,
    });

    if (isServiceError(searchResponse)) {
        return searchResponse;
    }

    const files = searchResponse.Result.Files;

    if (!files || files.length === 0) {
        return fileNotFound(fileName, repository);
    }

    const source = files[0].Content ?? '';
    return {
        source
    }
}