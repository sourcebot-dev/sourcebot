'use client';

import { useState, useCallback, useRef } from 'react';
import type {
    StreamSearchChunk,
    StreamSearchParams,
    StreamingSearchState,
    UseStreamingSearchReturn,
} from './types';

export function useStreamingSearch(): UseStreamingSearchReturn {
    const [state, setState] = useState<StreamingSearchState>({
        chunks: [],
        isStreaming: false,
        error: null,
        totalFiles: 0,
        totalMatches: 0,
    });
    
    const abortControllerRef = useRef<AbortController | null>(null);

    const streamSearch = useCallback(async (params: StreamSearchParams) => {
        // Cancel any existing stream
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        abortControllerRef.current = new AbortController();

        setState({
            chunks: [],
            isStreaming: true,
            error: null,
            totalFiles: 0,
            totalMatches: 0,
        });

        try {
            const response = await fetch('/api/stream_search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true as boolean) {
                const { done, value } = await reader.read();
                
                if (done) break;

                // Decode the chunk and add to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE messages (separated by \n\n)
                const messages = buffer.split('\n\n');
                buffer = messages.pop() || ''; // Keep incomplete message in buffer

                for (const message of messages) {
                    if (!message.trim()) continue;

                    // SSE messages start with "data: "
                    const dataMatch = message.match(/^data: (.+)$/);
                    if (!dataMatch) continue;

                    const data = dataMatch[1];

                    // Check for completion signal
                    if (data === '[DONE]') {
                        setState(prev => ({ ...prev, isStreaming: false }));
                        return;
                    }

                    // Parse the JSON chunk
                    try {
                        const chunk: StreamSearchChunk = JSON.parse(data);
                        
                        // Check for errors
                        if (chunk.error) {
                            throw new Error(chunk.error.message);
                        }

                        // Update state with new chunk
                        setState(prev => ({
                            ...prev,
                            chunks: [...prev.chunks, chunk],
                            totalFiles: prev.totalFiles + (chunk.response_chunk?.files?.length || 0),
                            totalMatches: prev.totalMatches + (chunk.response_chunk?.stats?.match_count || 0),
                        }));
                    } catch (parseError) {
                        console.error('Error parsing chunk:', parseError);
                    }
                }
            }

            setState(prev => ({ ...prev, isStreaming: false }));
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                console.log('Stream aborted');
            } else {
                setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    error: error as Error,
                }));
            }
        }
    }, []);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({ ...prev, isStreaming: false }));
    }, []);

    const reset = useCallback(() => {
        cancel();
        setState({
            chunks: [],
            isStreaming: false,
            error: null,
            totalFiles: 0,
            totalMatches: 0,
        });
    }, [cancel]);

    return {
        ...state,
        streamSearch,
        cancel,
        reset,
    };
}