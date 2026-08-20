'use client';

import { Separator } from '@/components/ui/separator';
import { ListSkillsMetadata, ToolResult } from '@/features/tools';

export const ListSkillsToolComponent = ({ metadata }: ToolResult<ListSkillsMetadata>) => {
    const label = `${metadata.count} ${metadata.count === 1 ? 'skill' : 'skills'}`;

    return (
        <div className="flex items-center gap-2 select-none cursor-default text-sm text-muted-foreground">
            <span className="flex-shrink-0">Listed skills</span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{label}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
};
