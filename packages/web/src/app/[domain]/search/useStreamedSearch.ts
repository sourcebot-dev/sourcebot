'use client';

import { RepositoryInfo, SearchRequest, SearchResultFile, SearchStats, StreamedSearchResponse } from '@/features/search';
import { useState, useCallback, useRef, useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface CacheEntry {
    files: SearchResultFile[];
    repoInfo: Record<number, RepositoryInfo>;
    numMatches: number;
    timeToSearchCompletionMs: number;
    timeToFirstSearchResultMs: number;
    timestamp: number;
    isExhaustive: boolean;
}

const searchCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000;

const createCacheKey = (params: SearchRequest): string => {
    return JSON.stringify({
        query: params.query,
        matches: params.matches,
        contextLines: params.contextLines,
        whole: params.whole,
        isRegexEnabled: params.isRegexEnabled,
        isCaseSensitivityEnabled: params.isCaseSensitivityEnabled,
    });
};

const isCacheValid = (entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp < CACHE_TTL;
};

export const useStreamedSearch = ({ query, matches, contextLines, whole, isRegexEnabled, isCaseSensitivityEnabled }: SearchRequest) => {
    const [state, setState] = useState<{
        isStreaming: boolean,
        isExhaustive: boolean,
        error: Error | null,
        files: SearchResultFile[],
        repoInfo: Record<number, RepositoryInfo>,
        timeToSearchCompletionMs: number,
        timeToFirstSearchResultMs: number,
        numMatches: number,
        stats?: SearchStats,
    }>({
        isStreaming: false,
        isExhaustive: false,
        error: null,
        files: [],
        repoInfo: {},
        timeToSearchCompletionMs: 0,
        timeToFirstSearchResultMs: 0,
        numMatches: 0,
        stats: undefined,
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

            const cacheKey = createCacheKey({
                query,
                matches,
                contextLines,
                whole,
                isRegexEnabled,
                isCaseSensitivityEnabled,
            });

            // Check if we have a valid cached result. If so, use it.
            const cachedEntry = searchCache.get(cacheKey);
            if (cachedEntry && isCacheValid(cachedEntry)) {
                console.debug('Using cached search results');
                setState({
                    isStreaming: false,
                    isExhaustive: cachedEntry.isExhaustive,
                    error: null,
                    files: cachedEntry.files,
                    repoInfo: cachedEntry.repoInfo,
                    timeToSearchCompletionMs: cachedEntry.timeToSearchCompletionMs,
                    timeToFirstSearchResultMs: cachedEntry.timeToFirstSearchResultMs,
                    numMatches: cachedEntry.numMatches,
                });
                return;
            }

            setState({
                isStreaming: true,
                isExhaustive: false,
                error: null,
                files: [],
                repoInfo: {},
                timeToSearchCompletionMs: 0,
                timeToFirstSearchResultMs: 0,
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
                        isRegexEnabled,
                        isCaseSensitivityEnabled,
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
                let numMessagesProcessed = 0;

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
                        if (!dataMatch) {
                            continue;
                        }

                        const data = dataMatch[1];

                        // Check for completion signal
                        if (data === '[DONE]') {
                            break;
                        }

                        const response: StreamedSearchResponse = JSON.parse(data);
                        const isFirstMessage = numMessagesProcessed === 0;
                        switch (response.type) {
                            case 'chunk':
                                setState(prev => ({
                                    ...prev,
                                    files: [
                                        ...prev.files,
                                        ...response.files
                                    ],
                                    repoInfo: {
                                        ...prev.repoInfo,
                                        ...response.repositoryInfo.reduce((acc, repo) => {
                                            acc[repo.id] = repo;
                                            return acc;
                                        }, {} as Record<number, RepositoryInfo>),
                                    },
                                    numMatches: prev.numMatches + response.stats.actualMatchCount,
                                    ...(isFirstMessage ? {
                                        timeToFirstSearchResultMs: performance.now() - startTime,
                                    } : {}),
                                }));
                                break;
                            case 'final':
                                setState(prev => ({
                                    ...prev,
                                    isExhaustive: response.isSearchExhaustive,
                                    stats: response.accumulatedStats,
                                    ...(isFirstMessage ? {
                                        timeToFirstSearchResultMs: performance.now() - startTime,
                                    } : {}),
                                }));
                                break;
                        }

                        numMessagesProcessed++;
                    }
                }

                const timeToSearchCompletionMs = performance.now() - startTime;
                setState(prev => {
                    // Cache the final results after the stream has completed.
                    searchCache.set(cacheKey, {
                        files: prev.files,
                        repoInfo: prev.repoInfo,
                        isExhaustive: prev.isExhaustive,
                        numMatches: prev.numMatches,
                        timeToFirstSearchResultMs: prev.timeToFirstSearchResultMs,
                        timeToSearchCompletionMs,
                        timestamp: Date.now(),
                    });
                    return {
                        ...prev,
                        timeToSearchCompletionMs,
                        isStreaming: false,
                    }
                });

            } catch (error) {
                if ((error as Error).name === 'AbortError') {
                    return;
                }

                console.error(error);
                Sentry.captureException(error);
                const timeToSearchCompletionMs = performance.now() - startTime;
                setState(prev => ({
                    ...prev,
                    isStreaming: false,
                    timeToSearchCompletionMs,
                    error: error as Error,
                }));
            }
        }

        search();

        return () => {
            cancel();
        }
    }, [
        query,
        matches,
        contextLines,
        whole,
        isRegexEnabled,
        isCaseSensitivityEnabled,
        cancel,
    ]);

    return {
        ...state,
        cancel,
    };
}