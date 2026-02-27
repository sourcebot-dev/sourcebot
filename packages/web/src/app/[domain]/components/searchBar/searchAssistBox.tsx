'use client';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/hooks/use-toast";
import useCaptureEvent from "@/hooks/useCaptureEvent";
import { translateSearchQuery } from "@/features/searchAssist/actions";
import { isServiceError } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Loader2, WandSparkles, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";

const SEARCH_ASSIST_DOCS_URL = "https://docs.sourcebot.dev/docs/features/search/ai-search-assist";

const EXAMPLES = [
    "Find next versions less than 15",
    "Find log4j versions 2.3.x or lower",
    "Find all todo comments",
];

interface SearchAssistBoxProps {
    isEnabled: boolean;
    onBlur: () => void;
    onQueryGenerated: (query: string) => void;
    className?: string;
}

export const SearchAssistBox = ({
    isEnabled,
    onBlur,
    onQueryGenerated,
    className,
}: SearchAssistBoxProps) => {
    const [query, setQuery] = useState("");
    const boxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const captureEvent = useCaptureEvent();

    const translateQuery = useCallback(async () => {
        if (!query.trim() || isLoading) {
            return;
        }

        setIsLoading(true);
        try {
            const result = await translateSearchQuery({ prompt: query });
            if (isServiceError(result)) {
                toast({ title: "Failed to generate query", description: result.message ?? "An unexpected error occurred.", variant: "destructive" });
                captureEvent('wa_search_assist_generate_failed', {});
                return;
            }
            onQueryGenerated(result.query);
            captureEvent('wa_search_assist_query_generated', {});
            setQuery("");
        } catch {
            toast({ title: "Failed to generate query", description: "An unexpected error occurred.", variant: "destructive" });
            captureEvent('wa_search_assist_generate_failed', {});
        } finally {
            setIsLoading(false);
        }
    }, [query, isLoading, toast, onQueryGenerated, captureEvent]);

    const onExampleClicked = useCallback((example: string) => {
        setQuery(example);
        inputRef.current?.focus();
        captureEvent('wa_search_assist_example_clicked', { example });
    }, [captureEvent]);

    if (!isEnabled) {
        return null;
    }

    return (
        <div
            ref={boxRef}
            className={cn("absolute z-10 left-16 right-0 max-w-[600px] border rounded-md bg-background drop-shadow-2xl p-2", className)}
            tabIndex={0}
            onBlur={(e) => {
                // Don't close if focus is moving to another element within this box
                if (boxRef.current?.contains(e.relatedTarget as Node)) {
                    return;
                }

                onBlur();
            }}
        >
            <div className="flex flex-row items-center gap-1.5 mb-2">
                <p className="text-muted-foreground text-sm">Generate a query</p>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[260px] flex flex-col gap-2 p-3">
                        <p className="text-sm">Describe what you&apos;re looking for in natural language and AI will generate a search query for you.</p>
                        <Link
                            href={SEARCH_ASSIST_DOCS_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline"
                        >
                            Learn more
                        </Link>
                    </TooltipContent>
                </Tooltip>
            </div>
            <div className="flex flex-row gap-2 items-center">
                <div className="relative flex-1">
                    <Input
                        placeholder="Describe what you're looking for..."
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                translateQuery();
                            }
                        }}
                        disabled={isLoading}
                        autoFocus
                        className="focus-visible:ring-0 focus-visible:ring-offset-0 h-9 pr-12"
                    />
                    {!isLoading && query.trim() && (
                        <div className="absolute right-2 inset-y-0 flex items-center pointer-events-none">
                            <kbd className="text-sm text-muted-foreground border rounded px-1 py-0.5">↵</kbd>
                        </div>
                    )}
                </div>
                <Button
                    size="sm"
                    onClick={translateQuery}
                    disabled={isLoading || !query.trim()}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <WandSparkles className="w-4 h-4" />
                    )}
                    Generate
                </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
                {EXAMPLES.map((example) => (
                    <button
                        key={example}
                        onClick={() => onExampleClicked(example)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                onExampleClicked(example);
                            }
                        }}
                        className="text-xs text-muted-foreground border rounded-full px-2.5 py-1 hover:bg-muted hover:text-foreground transition-colors"
                    >
                        {example}
                    </button>
                ))}
            </div>
        </div>
    )
}