'use client';

import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToolSearchResult {
    name: string;
    description: string;
}

interface ToolSearchToolComponentProps {
    query: string;
    results: ToolSearchResult[];
}

export const ToolSearchToolComponent = ({ query, results }: ToolSearchToolComponentProps) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full">
                <div className="flex items-center gap-2 select-none cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className={cn("w-3 h-3 flex-shrink-0 transition-transform", isOpen && "rotate-90")} />
                    <span className="flex-shrink-0">Searched MCP tools: <span className="italic">{query}</span></span>
                    <span className="flex-1" />
                    <span className="text-xs flex-shrink-0">{results.length} result{results.length === 1 ? '' : 's'}</span>
                    <Separator orientation="vertical" className="h-3 flex-shrink-0" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="ml-5 mt-1 space-y-0.5">
                    {results.map((result) => (
                        <div key={result.name} className="flex items-baseline gap-2 text-xs text-muted-foreground">
                            <span className="font-mono flex-shrink-0">{result.name}</span>
                            {result.description && (
                                <>
                                    <span className="text-muted-foreground/50">-</span>
                                    <span className="truncate">{result.description}</span>
                                </>
                            )}
                        </div>
                    ))}
                    {results.length === 0 && (
                        <span className="text-xs text-muted-foreground">No tools found</span>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};
