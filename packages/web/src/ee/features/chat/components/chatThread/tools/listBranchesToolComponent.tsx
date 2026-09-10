'use client';

import { Separator } from '@/components/ui/separator';
import { ListBranchesMetadata, ToolResult } from '@/features/tools';

export const ListBranchesToolComponent = ({ metadata }: ToolResult<ListBranchesMetadata>) => {
    const label = `${metadata.returnedCount}${metadata.totalCount > metadata.returnedCount ? ` of ${metadata.totalCount}` : ''} ${metadata.totalCount === 1 ? 'branch' : 'branches'}`;

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">Listed branches in</span>
            <span className="truncate text-foreground font-medium" title={metadata.repo}>{metadata.repo}</span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
