'use server';

import { searchRequestSchema } from '@/features/search/schemas';
import { SearchResponse, SourceRange } from '@/features/search/types';
import { schemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { prisma } from '@/prisma';
import type { ProtoGrpcType } from '@/proto/webserver';
import { Range__Output } from '@/proto/zoekt/webserver/v1/Range';
import type { SearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import type { StreamSearchRequest } from '@/proto/zoekt/webserver/v1/StreamSearchRequest';
import type { StreamSearchResponse__Output } from '@/proto/zoekt/webserver/v1/StreamSearchResponse';
import type { WebserverServiceClient } from '@/proto/zoekt/webserver/v1/WebserverService';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PrismaClient, Repo } from '@sourcebot/db';
import { createLogger, env } from '@sourcebot/shared';
import { NextRequest } from 'next/server';
import * as path from 'path';
import { parser } from '@sourcebot/query-language';
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

        const { query, matches, contextLines, whole } = parsed.data;

        const tree = parser.parse(query);
        const zoektQuery = transformToZoektQuery(tree, query);

        console.log(JSON.stringify(zoektQuery, null, 2));

        const searchRequest: SearchRequest = {
            query: zoektQuery,
            // query: {
            //     and: {
            //         // @todo: we should use repo_ids to filter out repositories that the user
            //         // has access to (if permission syncing is enabled!).
            //         children: [
            //             {
            //                 regexp: {
            //                     regexp: query,
            //                     case_sensitive: true,
            //                 }
            //             }
            //         ]
            //     }
            // },
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

    return new ReadableStream({
        async start(controller) {
            try {
                // @todo: we should just disable tenant enforcement for now.
                const metadata = new grpc.Metadata();
                metadata.add('x-sourcegraph-tenant-id', '1');

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
                const repos = new Map<string | number, Repo>();

                // Handle incoming data chunks
                grpcStream.on('data', async (chunk: StreamSearchResponse__Output) => {
                    console.log('chunk');

                    if (!isStreamActive) {
                        return;
                    }

                    // grpcStream.on doesn't actually await on our handler, so we need to
                    // explicitly pause the stream here to prevent the stream from completing
                    // prior to our asynchronous work being completed.
                    grpcStream?.pause();

                    try {
                        if (!chunk.response_chunk) {
                            logger.warn('No response chunk received');
                            return;
                        }

                        const files = (await Promise.all(chunk.response_chunk.files.map(async (file) => {
                            const fileNameChunks = file.chunk_matches.filter((chunk) => chunk.file_name);

                            const identifier = file.repository_id ?? file.repository;

                            // If the repository is not in the map, fetch it from the database.
                            if (!repos.has(identifier)) {
                                const repo = typeof identifier === 'number' ?
                                    await prisma.repo.findUnique({
                                        where: {
                                            id: identifier,
                                        },
                                    }) :
                                    await prisma.repo.findFirst({
                                        where: {
                                            name: identifier,
                                        },
                                    });

                                if (repo) {
                                    repos.set(identifier, repo);
                                }
                            }


                            const repo = repos.get(identifier);

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
                                                byteOffset: chunk.content_start.byte_offset ?? 0,
                                                column: chunk.content_start.column ?? 0,
                                                lineNumber: chunk.content_start.line_number ?? 0,
                                                // @nocheckin: Will need to figure out how to handle this case.
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
                        }))).filter(file => file !== undefined);

                        const actualMatchCount = files.reduce(
                            (acc, file) =>
                                // Match count is the sum of the number of chunk matches and file name matches.
                                acc + file.chunks.reduce(
                                    (acc, chunk) => acc + chunk.matchRanges.length,
                                    0,
                                ) + file.fileName.matchRanges.length,
                            0,
                        );

                        const response: SearchResponse = {
                            files,
                            repositoryInfo: Array.from(repos.values()).map((repo) => ({
                                id: repo.id,
                                codeHostType: repo.external_codeHostType,
                                name: repo.name,
                                displayName: repo.displayName ?? undefined,
                                webUrl: repo.webUrl ?? undefined,
                            })),
                            isBranchFilteringEnabled: false,
                            // @todo: we will need to figure out how to handle if a search is exhaustive or not
                            isSearchExhaustive: false,
                            stats: {
                                actualMatchCount,
                                // @todo: todo - 
                                totalMatchCount: 0,
                                duration: chunk.response_chunk.stats?.duration?.nanos ?? 0,
                                fileCount: chunk.response_chunk.stats?.file_count.valueOf() ?? 0,
                                filesSkipped: chunk.response_chunk.stats?.files_skipped.valueOf() ?? 0,
                                contentBytesLoaded: chunk.response_chunk.stats?.content_bytes_loaded.valueOf() ?? 0,
                                indexBytesLoaded: chunk.response_chunk.stats?.index_bytes_loaded.valueOf() ?? 0,
                                crashes: chunk.response_chunk.stats?.crashes.valueOf() ?? 0,
                                shardFilesConsidered: chunk.response_chunk.stats?.shard_files_considered.valueOf() ?? 0,
                                filesConsidered: chunk.response_chunk.stats?.files_considered.valueOf() ?? 0,
                                filesLoaded: chunk.response_chunk.stats?.files_loaded.valueOf() ?? 0,
                                shardsScanned: chunk.response_chunk.stats?.shards_scanned.valueOf() ?? 0,
                                shardsSkipped: chunk.response_chunk.stats?.shards_skipped.valueOf() ?? 0,
                                shardsSkippedFilter: chunk.response_chunk.stats?.shards_skipped_filter.valueOf() ?? 0,
                                ngramMatches: chunk.response_chunk.stats?.ngram_matches.valueOf() ?? 0,
                                ngramLookups: chunk.response_chunk.stats?.ngram_lookups.valueOf() ?? 0,
                                wait: chunk.response_chunk.stats?.wait?.nanos ?? 0,
                                matchTreeConstruction: chunk.response_chunk.stats?.match_tree_construction?.nanos ?? 0,
                                matchTreeSearch: chunk.response_chunk.stats?.match_tree_search?.nanos ?? 0,
                                regexpsConsidered: chunk.response_chunk.stats?.regexps_considered.valueOf() ?? 0,
                                // @todo: handle this.
                                flushReason: 0,
                            }
                        }

                        const sseData = `data: ${JSON.stringify(response)}\n\n`;
                        controller.enqueue(new TextEncoder().encode(sseData));
                    } catch (error) {
                        console.error('Error encoding chunk:', error);
                    } finally {
                        grpcStream?.resume();
                    }
                });

                // Handle stream completion
                grpcStream.on('end', () => {
                    if (!isStreamActive) {
                        return;
                    }
                    isStreamActive = false;

                    // Send completion signal
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                    controller.close();
                    console.log('SSE stream completed');
                    client.close();
                });

                // Handle errors
                grpcStream.on('error', (error: grpc.ServiceError) => {
                    console.error('gRPC stream error:', error);

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
                console.error('Stream initialization error:', error);

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
            console.log('SSE stream cancelled by client');
            isStreamActive = false;

            // Cancel the gRPC stream to stop receiving data
            if (grpcStream) {
                grpcStream.cancel();
            }

            client.close();
        }
    });
}