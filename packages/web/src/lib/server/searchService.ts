import escapeStringRegexp from "escape-string-regexp";
import { env } from "@/env.mjs";
import { listRepositoriesResponseSchema, zoektSearchResponseSchema } from "../schemas";
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "../types";
import { fileNotFound, invalidZoektResponse, ServiceError, unexpectedError } from "../serviceError";
import { isServiceError } from "../utils";
import { zoektFetch } from "./zoektClient";

// List of supported query prefixes in zoekt.
// @see : https://github.com/sourcebot-dev/zoekt/blob/main/query/parse.go#L417
enum zoektPrefixes {
    archived = "archived:",
    branchShort = "b:",
    branch =  "branch:",
    caseShort =  "c:",
    case =  "case:",
    content =  "content:",
    fileShort =  "f:",
    file =  "file:",
    fork =  "fork:",
    public =  "public:",
    repoShort =  "r:",
    repo =  "repo:",
    regex =  "regex:",
    lang =  "lang:",
    sym =  "sym:",
    typeShort =  "t:",
    type =  "type:",
}

// Mapping of additional "alias" prefixes to zoekt prefixes.
const aliasPrefixMappings: Record<string, zoektPrefixes> = {
    "rev:": zoektPrefixes.branch,
    "revision:": zoektPrefixes.branch,
}

export const search = async ({ query, maxMatchDisplayCount, whole}: SearchRequest, orgId: number): Promise<SearchResponse | ServiceError> => {
    // Replace any alias prefixes with their corresponding zoekt prefixes.
    for (const [prefix, zoektPrefix] of Object.entries(aliasPrefixMappings)) {
        query = query.replaceAll(prefix, zoektPrefix);
    }

    const isBranchFilteringEnabled = (
        query.includes(zoektPrefixes.branch) ||
        query.includes(zoektPrefixes.branchShort)
    );

    // We only want to show matches for the default branch when
    // the user isn't explicitly filtering by branch.
    if (!isBranchFilteringEnabled) {
        query = query.concat(` branch:HEAD`);
    }

    const body = JSON.stringify({
        q: query,
        // @see: https://github.com/sourcebot-dev/zoekt/blob/main/api.go#L892
        opts: {
            NumContextLines: 2,
            ChunkMatches: true,
            MaxMatchDisplayCount: maxMatchDisplayCount,
            Whole: !!whole,
            ShardMaxMatchCount: env.SHARD_MAX_MATCH_COUNT,
            TotalMaxMatchCount: env.TOTAL_MAX_MATCH_COUNT,
            MaxWallTime: env.ZOEKT_MAX_WALL_TIME_MS * 1000 * 1000, // zoekt expects a duration in nanoseconds
        }
    });

    let header: Record<string, string> = {};
    header = {
        "X-Tenant-ID": orgId.toString()
    };

    const searchResponse = await zoektFetch({
        path: "/api/search",
        body,
        header,
        method: "POST",
    });

    if (!searchResponse.ok) {
        return invalidZoektResponse(searchResponse);
    }

    const searchBody = await searchResponse.json();
    const parsedSearchResponse = zoektSearchResponseSchema.safeParse(searchBody);
    if (!parsedSearchResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedSearchResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return {
        ...parsedSearchResponse.data,
        isBranchFilteringEnabled,
    }
}

// @todo (bkellam) : We should really be using `git show <hash>:<path>` to fetch file contents here.
// This will allow us to support permalinks to files at a specific revision that may not be indexed
// by zoekt.
export const getFileSource = async ({ fileName, repository, branch }: FileSourceRequest, orgId: number): Promise<FileSourceResponse | ServiceError> => {
    const escapedFileName = escapeStringRegexp(fileName);
    const escapedRepository = escapeStringRegexp(repository);
    
    let query = `file:${escapedFileName} repo:^${escapedRepository}$`;
    if (branch) {
        query = query.concat(` branch:${branch}`);
    }

    const searchResponse = await search({
        query,
        maxMatchDisplayCount: 1,
        whole: true,
    }, orgId);

    if (isServiceError(searchResponse)) {
        return searchResponse;
    }

    const files = searchResponse.Result.Files;

    if (!files || files.length === 0) {
        return fileNotFound(fileName, repository);
    }

    const file = files[0];
    const source = file.Content ?? '';
    const language = file.Language;
    return {
        source,
        language,
    }
}

export const listRepositories = async (orgId: number): Promise<ListRepositoriesResponse | ServiceError> => {
    const body = JSON.stringify({
        opts: {
            Field: 0,
        }
    });

    let header: Record<string, string> = {};
    header = {
        "X-Tenant-ID": orgId.toString()
    };

    const listResponse = await zoektFetch({
        path: "/api/list",
        body,
        header,
        method: "POST",
        cache: "no-store",
    });

    if (!listResponse.ok) {
        return invalidZoektResponse(listResponse);
    }

    const listBody = await listResponse.json();
    const parsedListResponse = listRepositoriesResponseSchema.safeParse(listBody);
    if (!parsedListResponse.success) {
        console.error(`Failed to parse zoekt response. Error: ${parsedListResponse.error}`);
        return unexpectedError(`Something went wrong while parsing the response from zoekt`);
    }

    return parsedListResponse.data;
}