'use client';

import { ReadAttachmentMetadata, ToolResult } from "@/features/tools";
import { VscodeFileIcon } from "@/app/components/vscodeFileIcon";
import { Separator } from "@/components/ui/separator";

export const ReadAttachmentToolComponent = ({ metadata }: ToolResult<ReadAttachmentMetadata>) => {
    const linesRead = metadata.endLine - metadata.startLine + 1;

    return (
        <div className="flex items-center gap-2 select-none text-sm text-muted-foreground">
            <span className="flex-shrink-0">Read attachment</span>
            <span className="inline-flex items-center gap-1 text-xs bg-muted px-1.5 py-0.5 rounded min-w-0">
                <VscodeFileIcon fileName={metadata.filename} className="flex-shrink-0" />
                <span className="font-medium text-foreground truncate">{metadata.filename}</span>
                {(metadata.isTruncated || metadata.startLine > 1) && (
                    <span className="text-muted-foreground">L{metadata.startLine}-{metadata.endLine}</span>
                )}
            </span>
            <span className="flex-1" />
            <span className="text-xs flex-shrink-0">{linesRead} {linesRead === 1 ? 'line' : 'lines'}</span>
            <Separator orientation="vertical" className="h-3 flex-shrink-0" />
        </div>
    );
}
