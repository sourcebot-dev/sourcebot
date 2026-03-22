'use client';

import { FindSymbolReferencesMetadata, ToolResult } from "@/features/tools";
import { Separator } from "@/components/ui/separator";
import { VscSymbolMisc } from "react-icons/vsc";
import { RepoBadge } from "./repoBadge";

export const FindSymbolReferencesToolComponent = ({ metadata }: ToolResult<FindSymbolReferencesMetadata>) => {
    const label = `${metadata.matchCount} ${metadata.matchCount === 1 ? 'reference' : 'references'}`;

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">Resolved</span>
            <code className="inline-flex items-center gap-1 text-xs bg-muted px-1 py-0.5 rounded truncate text-foreground"><VscSymbolMisc className="flex-shrink-0" />{metadata.symbol}</code>
            <span className="flex-shrink-0">in</span>
            <RepoBadge repo={metadata.repoInfo} />
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
