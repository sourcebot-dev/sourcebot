'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ToolResult, UpdateSkillMetadata } from '@/features/tools';

export const UpdateSkillToolComponent = ({ metadata }: ToolResult<UpdateSkillMetadata>) => {
    return (
        <div className="flex items-center gap-2 select-none text-sm text-muted-foreground">
            <Sparkles className="w-3 h-3 flex-shrink-0" />
            <span className="flex-shrink-0">Updated {metadata.scope === 'shared' ? 'shared skill' : 'skill'}</span>
            <Link
                href={metadata.url}
                className="truncate text-foreground font-medium hover:underline"
                title={metadata.name}
            >
                {metadata.name}
            </Link>
            <span className="font-mono text-xs text-muted-foreground/70 flex-shrink-0">/{metadata.slug}</span>
            <span className="flex-1" />
        </div>
    );
};
