'use client';

import { useState } from 'react';
import { useStreamingSearch } from './useStreamingSearch';
import type { FileMatch__Output } from './types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

// @nocheckin
export default function StreamSearchPage() {
    const [query, setQuery] = useState('useMemo');
    const [matches, setMatches] = useState(10000);
    const [contextLines, _setContextLines] = useState(5);
    
    const { 
        chunks, 
        isStreaming, 
        totalFiles, 
        totalMatches, 
        error, 
        streamSearch, 
        cancel,
        reset 
    } = useStreamingSearch();

    const handleSearch = () => {
        streamSearch({
            query,
            matches,
            contextLines,
            whole: false,
        });
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Streaming Search Demo</h1>
                    <p className="text-muted-foreground">
                        Test the SSE streaming search API with real-time results
                    </p>
                </div>

                <Separator />

                {/* Search Controls */}
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium mb-1.5 block">
                                Search Query
                            </label>
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Enter search query (e.g., useMemo, file:.tsx)"
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                disabled={isStreaming}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">
                                Max Matches
                            </label>
                            <Input
                                type="number"
                                value={matches}
                                onChange={(e) => setMatches(Number(e.target.value))}
                                placeholder="Max matches"
                                disabled={isStreaming}
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button 
                            onClick={handleSearch} 
                            disabled={isStreaming || !query}
                            className="w-32"
                        >
                            {isStreaming ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Searching
                                </>
                            ) : (
                                'Search'
                            )}
                        </Button>
                        {isStreaming && (
                            <Button onClick={cancel} variant="destructive">
                                Cancel
                            </Button>
                        )}
                        {chunks.length > 0 && !isStreaming && (
                            <Button onClick={reset} variant="outline">
                                Clear Results
                            </Button>
                        )}
                    </div>
                </div>

                <Separator />

                {/* Results Stats */}
                {(isStreaming || chunks.length > 0) && (
                    <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <span className="font-semibold">Status:</span>{' '}
                                {isStreaming ? (
                                    <span className="text-blue-600 dark:text-blue-400">
                                        🔄 Streaming...
                                    </span>
                                ) : (
                                    <span className="text-green-600 dark:text-green-400">
                                        ✓ Complete
                                    </span>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold">Chunks:</span>{' '}
                                {chunks.length}
                            </div>
                            <div>
                                <span className="font-semibold">Files:</span>{' '}
                                {totalFiles}
                            </div>
                            <div>
                                <span className="font-semibold">Matches:</span>{' '}
                                {totalMatches}
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                        <div className="font-semibold text-destructive mb-1">
                            Error occurred:
                        </div>
                        <div className="text-sm text-destructive/80">
                            {error.message}
                        </div>
                    </div>
                )}

                {/* Results Display */}
                {chunks.length > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold">
                            Results ({chunks.length} chunks)
                        </h2>
                        
                        <div className="space-y-3">
                            {chunks.map((chunk, i) => (
                                <div 
                                    key={i} 
                                    className="border rounded-lg p-4 bg-card"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="text-sm font-medium text-muted-foreground">
                                            Chunk {i + 1}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {chunk.response_chunk?.files?.length || 0} files, {' '}
                                            {chunk.response_chunk?.stats?.match_count || 0} matches
                                        </div>
                                    </div>
                                    
                                    {chunk.response_chunk?.files && chunk.response_chunk.files.length > 0 && (
                                        <div className="space-y-2">
                                            {chunk.response_chunk.files.map((file: FileMatch__Output, j: number) => {
                                                // Decode file_name from Buffer to string
                                                const fileName = file.file_name 
                                                    ? Buffer.from(file.file_name).toString('utf-8')
                                                    : 'Unknown file';
                                                
                                                return (
                                                    <div 
                                                        key={j} 
                                                        className="text-sm pl-4 border-l-2 border-muted-foreground/20 py-1"
                                                    >
                                                        <div className="font-mono">
                                                            📄 {fileName}
                                                        </div>
                                                        {file.repository && (
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {file.repository}
                                                            </div>
                                                        )}
                                                        {file.language && (
                                                            <div className="text-xs text-muted-foreground">
                                                                Language: {file.language}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!isStreaming && chunks.length === 0 && !error && (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>Enter a search query and click &ldquo;Search&rdquo; to start streaming results</p>
                    </div>
                )}
            </div>
        </div>
    );
}