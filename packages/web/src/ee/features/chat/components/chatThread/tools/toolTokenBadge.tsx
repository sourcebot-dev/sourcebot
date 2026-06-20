'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getShortenedNumberDisplayString } from '@/lib/utils';

export const ToolTokenBadge = ({ estimatedOutputTokens }: { estimatedOutputTokens: number }) => (
    <Tooltip>
        <TooltipTrigger asChild>
            <span className="text-xs text-muted-foreground flex-shrink-0 cursor-help">
                ~{getShortenedNumberDisplayString(estimatedOutputTokens, 0)} tokens
            </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
            <div className="max-w-xs text-xs">
                Estimated input-token footprint of this tool&apos;s output when fed back to the model.
            </div>
        </TooltipContent>
    </Tooltip>
);