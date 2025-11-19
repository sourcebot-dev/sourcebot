'use server';

import { searchRequestSchema, SearchStats, SourceRange, StreamedSearchResponse } from '@/features/search/types';
import { SINGLE_TENANT_ORG_ID } from '@/lib/constants';
import { schemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { prisma } from '@/prisma';
import type { ProtoGrpcType } from '@/proto/webserver';
import { FileMatch__Output } from '@/proto/zoekt/webserver/v1/FileMatch';
import { Range__Output } from '@/proto/zoekt/webserver/v1/Range';
import type { SearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import { SearchResponse__Output } from '@/proto/zoekt/webserver/v1/SearchResponse';
import type { StreamSearchRequest } from '@/proto/zoekt/webserver/v1/StreamSearchRequest';
import type { StreamSearchResponse__Output } from '@/proto/zoekt/webserver/v1/StreamSearchResponse';
import type { WebserverServiceClient } from '@/proto/zoekt/webserver/v1/WebserverService';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as Sentry from '@sentry/nextjs';
import { PrismaClient, Repo } from '@sourcebot/db';
import { parser as _parser } from '@sourcebot/query-language';
import { createLogger, env } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import * as path from 'path';
import { transformToZoektQuery } from './transformer';

const logger = createLogger('streamSearchApi');

/**
 * Create a gRPC client for the Zoekt webserver
 */
function createGrpcClient(): WebserverServiceClient {
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

/**
 * POST handler for streaming search via SSE
 */
export const POST = async (request: NextRequest) => {
    try {
        // Parse and validate request body
        const body = await request.json();
        const parsed = await searchRequestSchema.safeParseAsync(body);

        if (!parsed.success) {
            return serviceErrorResponse(schemaValidationError(parsed.error));
        }

        const {
            query,
            matches,
            contextLines,
            whole,
            isRegexEnabled = false,
            isCaseSensitivityEnabled = false,
        } = parsed.data;

        const parser = _parser.configure({
            strict: true,
        });

        const tree = parser.parse(query);
        const zoektQuery = await transformToZoektQuery({
            tree,
            input: query,
            isCaseSensitivityEnabled,
            isRegexEnabled,
            onExpandSearchContext: async (contextName: string) => {
                const context = await prisma.searchContext.findUnique({
                    where: {
                        name_orgId: {
                            name: contextName,
                            orgId: SINGLE_TENANT_ORG_ID,
                        }
                    },
                    include: {
                        repos: true,
                    }
                });

                if (!context) {
                    throw new Error(`Search context "${contextName}" not found`);
                }

                return context.repos.map((repo) => repo.name);
            },
        });

        console.log(JSON.stringify(zoektQuery, null, 2));

        const searchRequest: SearchRequest = {
            query: {
                and: {
                    children: [
                        zoektQuery,
                        {
                            branch: {
                                pattern: 'HEAD',
                                exact: true,
                            }
                        }
                    ]
                }
            },
            opts: {
                chunk_matches: true,
                max_match_display_count: matches,
                total_max_match_count: matches + 1,
                num_context_lines: contextLines,
                whole: !!whole,
                shard_max_match_count: -1,
                max_wall_time: {
                    seconds: 0,
                }
            },
        };

        // @nocheckin: this should be using the `prisma` instance from the auth context.
        const stream = await createSSESearchStream(searchRequest, prisma);


        // Return streaming response with SSE headers
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable nginx buffering if applicable
            },
        });
    } catch (error) {
        console.error('Request handling error:', error);
        return new Response(
            JSON.stringify({
                error: {
                    message: error instanceof Error ? error.message : 'Internal server error'
                }
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
};

const createSSESearchStream = async (searchRequest: SearchRequest, prisma: PrismaClient): Promise<ReadableStream> => {
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
        flushReason: 0,
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

                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalResponse)}\n\n`));
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                    client.close();
                    logger.debug('SSE stream closed');
                }
            };

            try {
                const metadata = new grpc.Metadata();

                const streamRequest: StreamSearchRequest = {
                    request: searchRequest,
                };

                grpcStream = client.StreamSearch(streamRequest, metadata);

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
                const getRepoIdForFile = (file: FileMatch__Output): string | number => {
                    return file.repository_id ?? file.repository;
                }

                // `_reposMapCache` is used to cache repository metadata across all chunks.
                // This reduces the number of database queries required to transform file matches.
                const _reposMapCache = new Map<string | number, Repo>();

                // Creates a mapping between all repository ids in a given response
                // chunk. The mapping allows us to efficiently lookup repository metadata.
                const createReposMapForChunk = async (chunk: SearchResponse__Output): Promise<Map<string | number, Repo>> => {
                    const reposMap = new Map<string | number, Repo>();
                    await Promise.all(chunk.files.map(async (file) => {
                        const id = getRepoIdForFile(file);

                        const repo = await (async () => {
                            // If it's in the cache, return the cached value.
                            if (_reposMapCache.has(id)) {
                                return _reposMapCache.get(id);
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
                                _reposMapCache.set(id, repo);
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

                // Handle incoming data chunks
                grpcStream.on('data', async (chunk: StreamSearchResponse__Output) => {
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

                        const repoIdToRepoDBRecordMap = await createReposMapForChunk(chunk.response_chunk);

                        const files = chunk.response_chunk.files.map((file) => {
                            const fileNameChunks = file.chunk_matches.filter((chunk) => chunk.file_name);
                            const repoId = getRepoIdForFile(file);
                            const repo = repoIdToRepoDBRecordMap.get(repoId);

                            // This can happen if the user doesn't have access to the repository.
                            if (!repo) {
                                return undefined;
                            }

                            // @todo: address "file_name might not be a valid UTF-8 string" warning.
                            const fileName = file.file_name.toString('utf-8');

                            const convertRange = (range: Range__Output): SourceRange => ({
                                start: {
                                    byteOffset: range.start?.byte_offset ?? 0,
                                    column: range.start?.column ?? 0,
                                    lineNumber: range.start?.line_number ?? 0,
                                },
                                end: {
                                    byteOffset: range.end?.byte_offset ?? 0,
                                    column: range.end?.column ?? 0,
                                    lineNumber: range.end?.line_number ?? 0,
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
                                // @todo: we will need to have a mechanism of forming the file's web url.
                                webUrl: '',
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
                                                column: 0,
                                                lineNumber: 0,
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
                            totalMatchCount: chunk.response_chunk.stats?.match_count ?? 0,
                            duration: chunk.response_chunk.stats?.duration?.nanos ?? 0,
                            fileCount: chunk.response_chunk.stats?.file_count ?? 0,
                            filesSkipped: chunk.response_chunk.stats?.files_skipped ?? 0,
                            contentBytesLoaded: chunk.response_chunk.stats?.content_bytes_loaded ?? 0,
                            indexBytesLoaded: chunk.response_chunk.stats?.index_bytes_loaded ?? 0,
                            crashes: chunk.response_chunk.stats?.crashes ?? 0,
                            shardFilesConsidered: chunk.response_chunk.stats?.shard_files_considered ?? 0,
                            filesConsidered: chunk.response_chunk.stats?.files_considered ?? 0,
                            filesLoaded: chunk.response_chunk.stats?.files_loaded ?? 0,
                            shardsScanned: chunk.response_chunk.stats?.shards_scanned ?? 0,
                            shardsSkipped: chunk.response_chunk.stats?.shards_skipped ?? 0,
                            shardsSkippedFilter: chunk.response_chunk.stats?.shards_skipped_filter ?? 0,
                            ngramMatches: chunk.response_chunk.stats?.ngram_matches ?? 0,
                            ngramLookups: chunk.response_chunk.stats?.ngram_lookups ?? 0,
                            wait: chunk.response_chunk.stats?.wait?.nanos ?? 0,
                            matchTreeConstruction: chunk.response_chunk.stats?.match_tree_construction?.nanos ?? 0,
                            matchTreeSearch: chunk.response_chunk.stats?.match_tree_search?.nanos ?? 0,
                            regexpsConsidered: chunk.response_chunk.stats?.regexps_considered ?? 0,
                            // @todo: handle this.
                            // flushReason: chunk.response_chunk.stats?.flush_reason ?? 0,
                            flushReason: 0
                        }

                        accumulatedStats = accumulateStats(accumulatedStats, stats);

                        const response: StreamedSearchResponse = {
                            type: 'chunk',
                            files,
                            repositoryInfo: Array.from(repoIdToRepoDBRecordMap.values()).map((repo) => ({
                                id: repo.id,
                                codeHostType: repo.external_codeHostType,
                                name: repo.name,
                                displayName: repo.displayName ?? undefined,
                                webUrl: repo.webUrl ?? undefined,
                            })),
                            stats
                        }

                        const sseData = `data: ${JSON.stringify(response)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(sseData));
                    } catch (error) {
                        console.error('Error encoding chunk:', error);
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

                    // Send error as SSE event
                    const errorData = `data: ${JSON.stringify({
                        error: {
                            code: error.code,
                            message: error.details || error.message,
                        }
                    })}\n\n`;
                    controller.enqueue(new TextEncoder().encode(errorData));

                    controller.close();
                    client.close();
                });
            } catch (error) {
                logger.error('Stream initialization error:', error);

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const errorData = `data: ${JSON.stringify({
                    error: { message: errorMessage }
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(errorData));

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
        ...(a.flushReason === 0 ? {
            flushReason: b.flushReason
        } : {
            flushReason: a.flushReason,
        }),
    }
}