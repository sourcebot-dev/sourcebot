import escapeStringRegexp from "escape-string-regexp";
import { env } from "@/env.mjs";
import { listRepositoriesResponseSchema, zoektSearchResponseSchema } from "../schemas";
import { FileSourceRequest, FileSourceResponse, ListRepositoriesResponse, SearchRequest, SearchResponse } from "../types";
import { fileNotFound, invalidZoektResponse, ServiceError, unexpectedError } from "../serviceError";
import { isServiceError } from "../utils";
import { zoektFetch } from "./zoektClient";
import { prisma } from "@/prisma";
import { ErrorCode } from "../errorCodes";
import { StatusCodes } from "http-status-codes";

// List of supported query prefixes in zoekt.
// @see : https://github.com/sourcebot-dev/zoekt/blob/main/query/parse.go#L417
enum zoektPrefixes {
    archived = "archived:",
    branchShort = "b:",
    branch = "branch:",
    caseShort = "c:",
    case = "case:",
    content = "content:",
    fileShort = "f:",
    file = "file:",
    fork = "fork:",
    public = "public:",
    repoShort = "r:",
    repo = "repo:",
    regex = "regex:",
    lang = "lang:",
    sym = "sym:",
    typeShort = "t:",
    type = "type:",
    reposet = "reposet:",
}

const transformZoektQuery = async (query: string, orgId: number): Promise<string | ServiceError> => {
    const prevQueryParts = query.split(" ");
    const newQueryParts = [];

    for (const part of prevQueryParts) {

        // Handle mapping `rev:` and `revision:` to `branch:`
        if (part.match(/^-?(rev|revision):.+$/)) {
            const isNegated = part.startsWith("-");
            let revisionName = part.slice(part.indexOf(":") + 1);

            // Special case: `*` -> search all revisions.
            // In zoekt, providing a blank string will match all branches.
            // @see: https://github.com/sourcebot-dev/zoekt/blob/main/eval.go#L560-L562
            if (revisionName === "*") {
                revisionName = "";
            }
            newQueryParts.push(`${isNegated ? "-" : ""}${zoektPrefixes.branch}${revisionName}`);
        }

        // Expand `context:` into `reposet:` atom.
        else if (part.match(/^-?context:.+$/)) {
            const isNegated = part.startsWith("-");
            const contextName = part.slice(part.indexOf(":") + 1);

            const context = await prisma.searchContext.findUnique({
                where: {
                    name_orgId: {
                        name: contextName,
                        orgId,
                    }
                },
                include: {
                    repos: true,
                }
            });

            // If the context doesn't exist, return an error.
            if (!context) {
                return {
                    errorCode: ErrorCode.SEARCH_CONTEXT_NOT_FOUND,
                    message: `Search context "${contextName}" not found`,
                    statusCode: StatusCodes.NOT_FOUND,
                } satisfies ServiceError;
            }

            const names = context.repos.map((repo) => repo.name);
            newQueryParts.push(`${isNegated ? "-" : ""}${zoektPrefixes.reposet}${names.join(",")}`);
        }

        // no-op: add the original part to the new query parts.
        else {
            newQueryParts.push(part);
        }
    }

    return newQueryParts.join(" ");
}

export const search = async ({ query, maxMatchDisplayCount, whole }: SearchRequest, orgId: number): Promise<SearchResponse | ServiceError> => {
    const transformedQuery = await transformZoektQuery(query, orgId);
    if (isServiceError(transformedQuery)) {
        return transformedQuery;
    }
    query = transformedQuery;

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