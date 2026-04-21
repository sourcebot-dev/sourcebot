'use client';

import { Separator } from '@/components/ui/separator';
import { GetDiffMetadata, ToolResult } from '@/features/tools';

export const GetDiffToolComponent = ({ metadata }: ToolResult<GetDiffMetadata>) => {
    const fileCount = metadata.files.length;

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">Compared</span>
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {metadata.base}
            </span>
            <span className="flex-shrink-0">to</span>
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                {metadata.head}
            </span>
            <span className="flex-shrink-0">in</span>
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground truncate">
                {metadata.repo}
            </span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">
                {fileCount} changed {fileCount === 1 ? 'file' : 'files'}
            </span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
