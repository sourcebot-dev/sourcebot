'use client';

import { RepositoryInfo, SearchRequest, SearchResponse, SearchResultFile } from '@/features/search/types';
import { useState, useCallback, useRef, useEffect } from 'react';


export const useStreamedSearch = ({ query, matches, contextLines, whole }: SearchRequest) => {

    const [state, setState] = useState<{
        isStreaming: boolean,
        error: Error | null,
        files: SearchResultFile[],
        repoInfo: Record<number, RepositoryInfo>,
        durationMs: number,
        numMatches: number,
    }>({
        isStreaming: false,
        error: null,
        files: [],
        repoInfo: {},
        durationMs: 0,
        numMatches: 0,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const cancel = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({
            ...prev,
            isStreaming: false,
        }));
    }, []);

    useEffect(() => {
        const search = async () => {
            const startTime = performance.now();

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            abortControllerRef.current = new AbortController();

            setState({
                isStreaming: true,
                error: null,
                files: [],
                repoInfo: {},
                durationMs: 0,
                numMatches: 0,
            });

            try {
                const response = await fetch('/api/stream_search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        query,
                        matches,
                        contextLines,
                        whole,
                    }),
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

                    if (done) {
                        break;
                    }

                    // Decode the chunk and add to buffer
                    buffer += decoder.decode(value, { stream: true });

                    // Process complete SSE messages (separated by \n\n)
                    const messages = buffer.split('\n\n');

                    // Keep the last element (potentially incomplete message) in the buffer for the next chunk.
                    // Stream chunks can split messages mid-way, so we only process complete messages.
                    buffer = messages.pop() || '';

                    for (const message of messages) {
                        if (!message.trim()) {
                            continue;
                        }

                        // SSE messages start with "data: "
                        const dataMatch = message.match(/^data: (.+)$/);
                        if (!dataMatch) continue;

                        const data = dataMatch[1];

                        // Check for completion signal
                        if (data === '[DONE]') {
                            setState(prev => ({ ...prev, isStreaming: false }));
                            return;
                        }

                        try {
                            const chunk: SearchResponse = JSON.parse(data);
                            setState(prev => ({
                                ...prev,
                                files: [
                                    ...prev.files,
                                    ...chunk.files
                                ],
                                repoInfo: {
                                    ...prev.repoInfo,
                                    ...chunk.repositoryInfo.reduce((acc, repo) => {
                                        acc[repo.id] = repo;
                                        return acc;
                                    }, {} as Record<number, RepositoryInfo>),
                                },
                                numMatches: prev.numMatches + chunk.stats.actualMatchCount,
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
            } finally {
                const endTime = performance.now();
                const durationMs = endTime - startTime;
                setState(prev => ({
                    ...prev,
                    durationMs,
                }));
            }
        }

        search();

        return () => {
        }
    }, [query, matches, contextLines, whole]);

    return {
        ...state,
        cancel,
    };
}