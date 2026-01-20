import { getCodeHostBrowseFileAtBranchUrl } from "@/lib/utils";
import { unexpectedError } from "@/lib/serviceError";
import type { ProtoGrpcType } from '@/proto/webserver';
import { FileMatch__Output as ZoektGrpcFileMatch } from "@/proto/zoekt/webserver/v1/FileMatch";
import { FlushReason as ZoektGrpcFlushReason } from "@/proto/zoekt/webserver/v1/FlushReason";
import { Range__Output as ZoektGrpcRange } from "@/proto/zoekt/webserver/v1/Range";
import type { SearchRequest as ZoektGrpcSearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import { SearchResponse__Output as ZoektGrpcSearchResponse } from "@/proto/zoekt/webserver/v1/SearchResponse";
import { StreamSearchRequest as ZoektGrpcStreamSearchRequest } from "@/proto/zoekt/webserver/v1/StreamSearchRequest";
import { StreamSearchResponse__Output as ZoektGrpcStreamSearchResponse } from "@/proto/zoekt/webserver/v1/StreamSearchResponse";
import { WebserverServiceClient } from '@/proto/zoekt/webserver/v1/WebserverService';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient, Repo } from "@sourcebot/db";
import { createLogger, env } from "@sourcebot/shared";
import path from 'path';
import { isBranchQuery, QueryIR, someInQueryIR } from './ir';
import { RepositoryInfo, SearchResponse, SearchResultFile, SearchStats, SourceRange, StreamedSearchErrorResponse, StreamedSearchResponse } from "./types";
import { captureEvent } from "@/lib/posthog";

const logger = createLogger("zoekt-searcher");

/**
 * Creates a ZoektGrpcSearchRequest given a query IR.
 */
export const createZoektSearchRequest = async ({
    query,
    options,
    repoSearchScope,
}: {
    query: QueryIR;
    options: {
        matches: number,
        contextLines?: number,
        whole?: boolean,
    };
    // Allows the caller to scope the search to a specific set of repositories.
    repoSearchScope?: string[];
}) => {
    // Find if there are any `rev:` filters in the query.
    const containsRevExpression = someInQueryIR(query, (q) => isBranchQuery(q));

    const zoektSearchRequest: ZoektGrpcSearchRequest = {
        query: {
            and: {
                children: [
                    query,
                    // If the query does not contain a `rev:` filter, we default to searching `HEAD`.
                    ...(!containsRevExpression ? [{
                        branch: {
                            pattern: 'HEAD',
                            exact: true,
                        }
                    }] : []),
                    ...(repoSearchScope ? [{
                        repo_set: {
                            set: repoSearchScope.reduce((acc, repo) => {
                                acc[repo] = true;
                                return acc;
                            }, {} as Record<string, boolean>)
                        }
                    }] : []),
                ]
            }
        },
        opts: {
            chunk_matches: true,
            // @note: Zoekt has several different ways to limit a given search. The two that
            // we care about are `MaxMatchDisplayCount` and `TotalMaxMatchCount`:
            // - `MaxMatchDisplayCount` truncates the number of matches AFTER performing
            //   a search (specifically, after collating and sorting the results). The number of
            //   results returned by the API will be less than or equal to this value.
            //
            // - `TotalMaxMatchCount` truncates the number of matches DURING a search. The results
            //   returned by the API the API can be less than, equal to, or greater than this value.
            //   Why greater? Because this value is compared _after_ a given shard has finished
            //   being processed, the number of matches returned by the last shard may have exceeded
            //   this value.
            //
            // Let's define two variables:
            // - `actualMatchCount` : The number of matches that are returned by the API. This is
            //   always less than or equal to `MaxMatchDisplayCount`.
            // - `totalMatchCount` : The number of matches that zoekt found before it either
            //   1) found all matches or 2) hit the `TotalMaxMatchCount` limit. This number is
            //   not bounded and can be less than, equal to, or greater than both `TotalMaxMatchCount`
            //   and `MaxMatchDisplayCount`.
            //
            //
            // Our challenge is to determine whether or not the search returned all possible matches/
            // (it was exaustive) or if it was truncated. By setting the `TotalMaxMatchCount` to
            // `MaxMatchDisplayCount + 1`, we can determine which of these occurred by comparing
            // `totalMatchCount` to `MaxMatchDisplayCount`.
            //
            // if (totalMatchCount ≤ actualMatchCount):
            //     Search is EXHAUSTIVE (found all possible matches)
            //     Proof: totalMatchCount ≤ MaxMatchDisplayCount < TotalMaxMatchCount
            //         Therefore Zoekt stopped naturally, not due to limit
            //     
            // if (totalMatchCount > actualMatchCount):
            //     Search is TRUNCATED (more matches exist)
            //     Proof: totalMatchCount > MaxMatchDisplayCount + 1 = TotalMaxMatchCount
            //         Therefore Zoekt hit the limit and stopped searching
            //
            max_match_display_count: options.matches,
            total_max_match_count: options.matches + 1,
            num_context_lines: options.contextLines ?? 0,
            whole: !!options.whole,
            shard_max_match_count: -1,
            max_wall_time: {
                seconds: 0,
            }
        },
    };

    return zoektSearchRequest;
}

export const zoektSearch = async (searchRequest: ZoektGrpcSearchRequest, prisma: PrismaClient): Promise<SearchResponse> => {
    const client = createGrpcClient();
    const metadata = new grpc.Metadata();

    return new Promise((resolve, reject) => {
        client.Search(searchRequest, metadata, (error, response) => {
            if (error || !response) {
                reject(error || new Error('No response received'));
                return;
            }

            (async () => {
                try {
                    const reposMapCache = await createReposMapForChunk(response, new Map<string | number, Repo>(), prisma);
                    const { stats, files, repositoryInfo } = await transformZoektSearchResponse(response, reposMapCache);

                    resolve({
                        stats,
                        files,
                        repositoryInfo,
                        isSearchExhaustive: stats.totalMatchCount <= stats.actualMatchCount,
                    } satisfies SearchResponse);
                } catch (err) {
                    reject(err);
                }
            })();
        });
    });
}

export const zoektStreamSearch = async (searchRequest: ZoektGrpcSearchRequest, prisma: PrismaClient): Promise<ReadableStream> => {
    const client = createGrpcClient();
    let grpcStream: ReturnType<WebserverServiceClient['StreamSearch']> | null = null;
    let isStreamActive = true;
    let pendingChunks = 0;
    let accumulatedStats: SearchStats = {
        actualMatchCount: 0,
        totalMatchCount: 0,
        duration: 0,
        fileCount: 0,
        filesSkipped: 0,
        contentBytesLoaded: 0,
        indexBytesLoaded: 0,
        crashes: 0,
        shardFilesConsidered: 0,
        filesConsidered: 0,
        filesLoaded: 0,
        shardsScanned: 0,
        shardsSkipped: 0,
        shardsSkippedFilter: 0,
        ngramMatches: 0,
        ngramLookups: 0,
        wait: 0,
        matchTreeConstruction: 0,
        matchTreeSearch: 0,
        regexpsConsidered: 0,
        flushReason: ZoektGrpcFlushReason.FLUSH_REASON_UNKNOWN_UNSPECIFIED,
    };

    return new ReadableStream({
        async start(controller) {
            const tryCloseController = () => {
                if (!isStreamActive && pendingChunks === 0) {
                    const finalResponse: StreamedSearchResponse = {
                        type: 'final',
                        accumulatedStats,
                        isSearchExhaustive: accumulatedStats.totalMatchCount <= accumulatedStats.actualMatchCount,
                    }

                    controller.enqueue(encodeSSEREsponseChunk(finalResponse));
                    controller.enqueue(encodeSSEREsponseChunk('[DONE]'));
                    controller.close();
                    client.close();
                    logger.debug('SSE stream closed');
                }
            };

            try {
                const metadata = new grpc.Metadata();

                const streamRequest: ZoektGrpcStreamSearchRequest = {
                    request: searchRequest,
                };

                grpcStream = client.StreamSearch(streamRequest, metadata);

                // `_reposMapCache` is used to cache repository metadata across all chunks.
                // This reduces the number of database queries required to transform file matches.
                const _reposMapCache = new Map<string | number, Repo>();

                // Handle incoming data chunks
                grpcStream.on('data', async (chunk: ZoektGrpcStreamSearchResponse) => {
                    if (!isStreamActive) {
                        logger.debug('SSE stream closed, skipping chunk');
                        return;
                    }

                    // Track that we're processing a chunk
                    pendingChunks++;

                    // grpcStream.on doesn't actually await on our handler, so we need to
                    // explicitly pause the stream here to prevent the stream from completing
                    // prior to our asynchronous work being completed.
                    grpcStream?.pause();

                    try {
                        if (!chunk.response_chunk) {
                            logger.warn('No response chunk received');
                            return;
                        }

                        const reposMapCache = await createReposMapForChunk(chunk.response_chunk, _reposMapCache, prisma);
                        const { stats, files, repositoryInfo } = await transformZoektSearchResponse(chunk.response_chunk, reposMapCache);

                        accumulatedStats = accumulateStats(accumulatedStats, stats);

                        const response: StreamedSearchResponse = {
                            type: 'chunk',
                            files,
                            repositoryInfo,
                            stats
                        }

                        controller.enqueue(encodeSSEREsponseChunk(response));
                    } catch (error) {
                        logger.error('Error processing chunk:', error);
                        Sentry.captureException(error);
                        isStreamActive = false;

                        const errorMessage = error instanceof Error ? error.message : 'Unknown error processing chunk';
                        const errorResponse: StreamedSearchErrorResponse = {
                            type: 'error',
                            error: unexpectedError(errorMessage),
                        };
                        controller.enqueue(encodeSSEREsponseChunk(errorResponse));
                    } finally {
                        pendingChunks--;
                        grpcStream?.resume();

                        // @note: we were hitting "Controller is already closed" errors when calling
                        // `controller.enqueue` above for the last chunk. The reasoning was the event
                        // handler for 'end' was being invoked prior to the completion of the last chunk,
                        // resulting in the controller being closed prematurely. The workaround was to
                        // keep track of the number of pending chunks and only close the controller
                        // when there are no more chunks to process. We need to explicitly call
                        // `tryCloseController` since there _seems_ to be no ordering guarantees between
                        // the 'end' event handler and this callback.
                        tryCloseController();
                    }
                });

                // Handle stream completion
                grpcStream.on('end', () => {
                    if (!isStreamActive) {
                        return;
                    }
                    isStreamActive = false;
                    tryCloseController();
                });

                // Handle errors
                grpcStream.on('error', (error: grpc.ServiceError) => {
                    logger.error('gRPC stream error:', error);
                    Sentry.captureException(error);

                    if (!isStreamActive) {
                        return;
                    }
                    isStreamActive = false;

                    // Send properly typed error response
                    const errorResponse: StreamedSearchErrorResponse = {
                        type: 'error',
                        error: unexpectedError(error.details || error.message),
                    };
                    controller.enqueue(encodeSSEREsponseChunk(errorResponse));

                    controller.close();
                    client.close();
                });
            } catch (error) {
                logger.error('Stream initialization error:', error);
                Sentry.captureException(error);

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorResponse: StreamedSearchErrorResponse = {
                    type: 'error',
                    error: unexpectedError(errorMessage),
                };
                controller.enqueue(encodeSSEREsponseChunk(errorResponse));

                controller.close();
                client.close();
            }
        },
        cancel() {
            logger.warn('SSE stream cancelled by client');
            isStreamActive = false;

            // Cancel the gRPC stream to stop receiving data
            if (grpcStream) {
                grpcStream.cancel();
            }

            client.close();
        }
    });
}

// Encodes a response chunk into a SSE-compatible format.
const encodeSSEREsponseChunk = (response: object | string) => {
    const data = typeof response === 'string' ? response : JSON.stringify(response);
    return new TextEncoder().encode(`data: ${data}\n\n`);
}

// Creates a mapping between all repository ids in a given response
// chunk. The mapping allows us to efficiently lookup repository metadata.
const createReposMapForChunk = async (chunk: ZoektGrpcSearchResponse, reposMapCache: Map<string | number, Repo>, prisma: PrismaClient): Promise<Map<string | number, Repo>> => {
    const reposMap = new Map<string | number, Repo>();
    await Promise.all(chunk.files.map(async (file) => {
        const id = getRepoIdForFile(file);

        const repo = await (async () => {
            // If it's in the cache, return the cached value.
            if (reposMapCache.has(id)) {
                return reposMapCache.get(id);
            }

            // Otherwise, query the database for the record.
            const repo = typeof id === 'number' ?
                await prisma.repo.findUnique({
                    where: {
                        id: id,
                    },
                }) :
                await prisma.repo.findFirst({
                    where: {
                        name: id,
                    },
                });

            // If a repository is found, cache it for future lookups.
            if (repo) {
                reposMapCache.set(id, repo);
            }

            return repo;
        })();

        // Only add the repository to the map if it was found.
        if (repo) {
            reposMap.set(id, repo);
        }
    }));

    return reposMap;
}

const transformZoektSearchResponse = async (response: ZoektGrpcSearchResponse, reposMapCache: Map<string | number, Repo>): Promise<{
    stats: SearchStats,
    files: SearchResultFile[],
    repositoryInfo: RepositoryInfo[],
}> => {
    const files = response.files.map((file) => {
        const fileNameChunks = file.chunk_matches.filter((chunk) => chunk.file_name);
        const repoId = getRepoIdForFile(file);
        const repo = reposMapCache.get(repoId);

        // This can happen when a shard exists for a repository that does not exist in the database.
        // In this case, issue a error message and skip the file.
        // @see: https://github.com/sourcebot-dev/sourcebot/issues/669
        if (!repo) {
            const errorMessage = `Unable to find repository "${file.repository}" in database for file "${file.file_name}". This can happen when a search shard exists for a repository that does not exist in the database. See https://github.com/sourcebot-dev/sourcebot/issues/669 for more details. Skipping file...`;

            logger.error(errorMessage);
            Sentry.captureMessage(errorMessage);
            captureEvent('wa_repo_not_found_for_zoekt_file', {});

            return undefined;
        }

        // @todo: address "file_name might not be a valid UTF-8 string" warning.
        const fileName = file.file_name.toString('utf-8');

        const convertRange = (range: ZoektGrpcRange): SourceRange => ({
            start: {
                byteOffset: range.start?.byte_offset ?? 0,
                column: range.start?.column ?? 1,
                lineNumber: range.start?.line_number ?? 1,
            },
            end: {
                byteOffset: range.end?.byte_offset ?? 0,
                column: range.end?.column ?? 1,
                lineNumber: range.end?.line_number ?? 1,
            }
        })

        return {
            fileName: {
                text: fileName,
                matchRanges: fileNameChunks.length === 1 ? fileNameChunks[0].ranges.map(convertRange) : [],
            },
            repository: repo.name,
            repositoryId: repo.id,
            language: file.language,
            webUrl: getCodeHostBrowseFileAtBranchUrl({
                webUrl: repo.webUrl,
                codeHostType: repo.external_codeHostType,
                // If a file has multiple branches, default to the first one.
                branchName: file.branches?.[0] ?? 'HEAD',
                filePath: fileName,
            }),
            chunks: file.chunk_matches
                .filter((chunk) => !chunk.file_name) // filter out filename chunks.
                .map((chunk) => {
                    return {
                        content: chunk.content.toString('utf-8'),
                        matchRanges: chunk.ranges.map(convertRange),
                        contentStart: chunk.content_start ? {
                            byteOffset: chunk.content_start.byte_offset,
                            column: chunk.content_start.column,
                            lineNumber: chunk.content_start.line_number,
                        } : {
                            byteOffset: 0,
                            column: 1,
                            lineNumber: 1,
                        },
                        symbols: chunk.symbol_info.map((symbol) => {
                            return {
                                symbol: symbol.sym,
                                kind: symbol.kind,
                                parent: symbol.parent ? {
                                    symbol: symbol.parent,
                                    kind: symbol.parent_kind,
                                } : undefined,
                            }
                        })
                    }
                }),
            branches: file.branches,
            content: file.content ? file.content.toString('utf-8') : undefined,
        }
    }).filter(file => file !== undefined);

    const actualMatchCount = files.reduce(
        (acc, file) =>
            // Match count is the sum of the number of chunk matches and file name matches.
            acc + file.chunks.reduce(
                (acc, chunk) => acc + chunk.matchRanges.length,
                0,
            ) + file.fileName.matchRanges.length,
        0,
    );

    const stats: SearchStats = {
        actualMatchCount,
        totalMatchCount: response.stats?.match_count ?? 0,
        duration: response.stats?.duration?.nanos ?? 0,
        fileCount: response.stats?.file_count ?? 0,
        filesSkipped: response.stats?.files_skipped ?? 0,
        contentBytesLoaded: response.stats?.content_bytes_loaded ?? 0,
        indexBytesLoaded: response.stats?.index_bytes_loaded ?? 0,
        crashes: response.stats?.crashes ?? 0,
        shardFilesConsidered: response.stats?.shard_files_considered ?? 0,
        filesConsidered: response.stats?.files_considered ?? 0,
        filesLoaded: response.stats?.files_loaded ?? 0,
        shardsScanned: response.stats?.shards_scanned ?? 0,
        shardsSkipped: response.stats?.shards_skipped ?? 0,
        shardsSkippedFilter: response.stats?.shards_skipped_filter ?? 0,
        ngramMatches: response.stats?.ngram_matches ?? 0,
        ngramLookups: response.stats?.ngram_lookups ?? 0,
        wait: response.stats?.wait?.nanos ?? 0,
        matchTreeConstruction: response.stats?.match_tree_construction?.nanos ?? 0,
        matchTreeSearch: response.stats?.match_tree_search?.nanos ?? 0,
        regexpsConsidered: response.stats?.regexps_considered ?? 0,
        flushReason: response.stats?.flush_reason?.toString() ?? ZoektGrpcFlushReason.FLUSH_REASON_UNKNOWN_UNSPECIFIED,
    }

    return {
        files,
        repositoryInfo: Array.from(reposMapCache.values()).map((repo) => ({
            id: repo.id,
            codeHostType: repo.external_codeHostType,
            name: repo.name,
            displayName: repo.displayName ?? undefined,
            webUrl: repo.webUrl ?? undefined,
        })),
        stats,
    }
}

// @note (2025-05-12): in zoekt, repositories are identified by the `RepositoryID` field
// which corresponds to the `id` in the Repo table. In order to efficiently fetch repository
// metadata when transforming (potentially thousands) of file matches, we aggregate a unique
// set of repository ids* and map them to their corresponding Repo record.
//
// *Q: Why is `RepositoryID` optional? And why are we falling back to `Repository`?
//  A: Prior to this change, the repository id was not plumbed into zoekt, so RepositoryID was
// always undefined. To make this a non-breaking change, we fallback to using the repository's name
// (`Repository`) as the identifier in these cases. This is not guaranteed to be unique, but in
// practice it is since the repository name includes the host and path (e.g., 'github.com/org/repo',
// 'gitea.com/org/repo', etc.).
// 
// Note: When a repository is re-indexed (every hour) this ID will be populated.
// @see: https://github.com/sourcebot-dev/zoekt/pull/6
const getRepoIdForFile = (file: ZoektGrpcFileMatch): string | number => {
    return file.repository_id ?? file.repository;
}

const createGrpcClient = (): WebserverServiceClient => {
    // Path to proto files - these should match your monorepo structure
    const protoBasePath = path.join(process.cwd(), '../../vendor/zoekt/grpc/protos');
    const protoPath = path.join(protoBasePath, 'zoekt/webserver/v1/webserver.proto');

    const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [protoBasePath],
    });

    const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

    // Extract host and port from ZOEKT_WEBSERVER_URL
    const zoektUrl = new URL(env.ZOEKT_WEBSERVER_URL);
    const grpcAddress = `${zoektUrl.hostname}:${zoektUrl.port}`;

    return new proto.zoekt.webserver.v1.WebserverService(
        grpcAddress,
        grpc.credentials.createInsecure(),
        {
            'grpc.max_receive_message_length': 500 * 1024 * 1024, // 500MB
            'grpc.max_send_message_length': 500 * 1024 * 1024,    // 500MB
        }
    );
}


const accumulateStats = (a: SearchStats, b: SearchStats): SearchStats => {
    return {
        actualMatchCount: a.actualMatchCount + b.actualMatchCount,
        totalMatchCount: a.totalMatchCount + b.totalMatchCount,
        duration: a.duration + b.duration,
        fileCount: a.fileCount + b.fileCount,
        filesSkipped: a.filesSkipped + b.filesSkipped,
        contentBytesLoaded: a.contentBytesLoaded + b.contentBytesLoaded,
        indexBytesLoaded: a.indexBytesLoaded + b.indexBytesLoaded,
        crashes: a.crashes + b.crashes,
        shardFilesConsidered: a.shardFilesConsidered + b.shardFilesConsidered,
        filesConsidered: a.filesConsidered + b.filesConsidered,
        filesLoaded: a.filesLoaded + b.filesLoaded,
        shardsScanned: a.shardsScanned + b.shardsScanned,
        shardsSkipped: a.shardsSkipped + b.shardsSkipped,
        shardsSkippedFilter: a.shardsSkippedFilter + b.shardsSkippedFilter,
        ngramMatches: a.ngramMatches + b.ngramMatches,
        ngramLookups: a.ngramLookups + b.ngramLookups,
        wait: a.wait + b.wait,
        matchTreeConstruction: a.matchTreeConstruction + b.matchTreeConstruction,
        matchTreeSearch: a.matchTreeSearch + b.matchTreeSearch,
        regexpsConsidered: a.regexpsConsidered + b.regexpsConsidered,
        // Capture the first non-unknown flush reason.
        ...(a.flushReason === ZoektGrpcFlushReason.FLUSH_REASON_UNKNOWN_UNSPECIFIED ? {
            flushReason: b.flushReason
        } : {
            flushReason: a.flushReason,
        }),
    }
}