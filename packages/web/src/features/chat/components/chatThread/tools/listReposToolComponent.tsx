'use client';

import { ListReposMetadata, ToolResult } from "@/features/tools";
import { Separator } from "@/components/ui/separator";

export const ListReposToolComponent = ({ metadata }: ToolResult<ListReposMetadata>) => {
    const count = metadata.repos.length;
    const label = `${count}${metadata.totalCount > count ? ` of ${metadata.totalCount}` : ''} ${count === 1 ? 'repo' : 'repos'}`;

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">Listed repositories</span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
