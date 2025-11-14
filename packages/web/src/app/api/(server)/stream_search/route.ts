'use server';

import { NextRequest } from 'next/server';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import type { ProtoGrpcType } from '@/proto/webserver';
import type { WebserverServiceClient } from '@/proto/zoekt/webserver/v1/WebserverService';
import type { SearchRequest } from '@/proto/zoekt/webserver/v1/SearchRequest';
import type { StreamSearchRequest } from '@/proto/zoekt/webserver/v1/StreamSearchRequest';
import type { StreamSearchResponse__Output } from '@/proto/zoekt/webserver/v1/StreamSearchResponse';
import { env } from '@sourcebot/shared';
import { schemaValidationError, serviceErrorResponse } from '@/lib/serviceError';
import { searchRequestSchema } from '@/features/search/schemas';

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

        const searchRequest: SearchRequest = {
            query: {
                and: {
                    children: [
                        {
                            regexp: {
                                regexp: parsed.data.query,
                                case_sensitive: true,
                            }
                        }
                    ]
                }
            },
            opts: {
                chunk_matches: true,
                num_context_lines: parsed.data.contextLines ?? 5,
                total_max_match_count: parsed.data.matches,
            },
        };

        // Create ReadableStream for SSE
        const stream = new ReadableStream({
            async start(controller) {
                const client = createGrpcClient();
                
                try {
                    const metadata = new grpc.Metadata();
                    metadata.add('x-sourcegraph-tenant-id', '1');

                    const streamRequest: StreamSearchRequest = {
                        request: searchRequest,
                    };

                    const grpcStream = client.StreamSearch(streamRequest, metadata);

                    // Handle incoming data chunks
                    grpcStream.on('data', (chunk: StreamSearchResponse__Output) => {
                        try {
                            // SSE format: "data: {json}\n\n"
                            const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
                            controller.enqueue(new TextEncoder().encode(sseData));
                        } catch (error) {
                            console.error('Error encoding chunk:', error);
                        }
                    });

                    // Handle stream completion
                    grpcStream.on('end', () => {
                        // Send completion signal
                        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                        controller.close();
                        client.close();
                    });

                    // Handle errors
                    grpcStream.on('error', (error: grpc.ServiceError) => {
                        console.error('gRPC stream error:', error);
                        
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
                // Cleanup when client cancels the stream
                console.log('SSE stream cancelled by client');
            }
        });

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