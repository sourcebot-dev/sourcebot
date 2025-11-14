/**
 * Types for streaming search functionality
 */

import type { StreamSearchResponse__Output } from '@/proto/zoekt/webserver/v1/StreamSearchResponse';
import type { SearchResponse__Output } from '@/proto/zoekt/webserver/v1/SearchResponse';
import type { FileMatch__Output } from '@/proto/zoekt/webserver/v1/FileMatch';
import type { Stats__Output } from '@/proto/zoekt/webserver/v1/Stats';
import type { ChunkMatch__Output } from '@/proto/zoekt/webserver/v1/ChunkMatch';
import type { Progress__Output } from '@/proto/zoekt/webserver/v1/Progress';

/**
 * A single chunk received from the streaming search API
 */
export interface StreamSearchChunk {
    response_chunk?: SearchResponse__Output | null;
    error?: StreamSearchError;
}

/**
 * Error response from the streaming search
 */
export interface StreamSearchError {
    code?: number;
    message: string;
}

/**
 * Parameters for initiating a streaming search
 */
export interface StreamSearchParams {
    query: string;
    matches: number;
    contextLines?: number;
    whole?: boolean;
}

/**
 * State of the streaming search
 */
export interface StreamingSearchState {
    chunks: StreamSearchChunk[];
    isStreaming: boolean;
    error: Error | null;
    totalFiles: number;
    totalMatches: number;
}

/**
 * Return type of the useStreamingSearch hook
 */
export interface UseStreamingSearchReturn extends StreamingSearchState {
    streamSearch: (params: StreamSearchParams) => Promise<void>;
    cancel: () => void;
    reset: () => void;
}

/**
 * Re-export proto types for convenience
 */
export type { 
    StreamSearchResponse__Output,
    SearchResponse__Output,
    FileMatch__Output,
    Stats__Output,
    ChunkMatch__Output,
    Progress__Output,
};

